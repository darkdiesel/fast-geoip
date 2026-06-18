import fs from 'fs/promises'
import path from 'path'
import * as utils from './utils'
import * as params from './params'

interface Params {
  LOCATION_RECORD_SIZE: number
  NUMBER_NODES_PER_MIDINDEX: number
}

const { LOCATION_RECORD_SIZE, NUMBER_NODES_PER_MIDINDEX } = params as Params

let cacheEnabled = false
const ipCache = new Map<string, ipBlockRecord[] | indexFile>()
let locationCache: Promise<locationRecord[]>

const DATA_DIR = path.join(path.dirname(__dirname), 'data')

export function enableCache(): void {
  if (!cacheEnabled) {
    locationCache = readFile<locationRecord[]>('locations.json').then((data) => {
      cacheEnabled = true
      return data
    })
  }
}

type indexFile = number[]
type ipBlockRecord = [number, number | null, number, number, number]
type locationRecord = [string, string, string, number, string, '0' | '1']

async function readFile<T extends indexFile | ipBlockRecord[] | locationRecord[]>(
  filename: string
): Promise<T> {
  const cached = ipCache.get(filename)
  if (cacheEnabled && cached !== undefined) {
    return cached as T
  }

  const raw = await fs.readFile(path.join(DATA_DIR, filename))
  const content: T = JSON.parse(raw.toString())

  if (cacheEnabled) {
    ipCache.set(filename, content as ipBlockRecord[] | indexFile)
  }

  return content
}

async function readFileChunk(
  filename: string,
  offset: number,
  length: number
): Promise<locationRecord> {
  const fd = await fs.open(path.join(DATA_DIR, filename), 'r')
  try {
    const buf = Buffer.alloc(length)
    const { buffer: readBuf } = await fd.read(buf, 0, length, offset)
    return JSON.parse(readBuf.toString())
  } finally {
    await fd.close()
  }
}

function readLocationRecord(index: number): Promise<locationRecord> {
  if (cacheEnabled) {
    return locationCache.then((locations) => locations[index])
  }
  return readFileChunk(
    'locations.json',
    index * LOCATION_RECORD_SIZE + 1,
    LOCATION_RECORD_SIZE - 1
  )
}

type extractKeyFunction<T> = (record: T) => number

function firstArrayItem(item: ipBlockRecord): number {
  return item[0]
}

function getNextIp<T>(
  data: T[],
  index: number,
  currentNextIp: number,
  extractKey: extractKeyFunction<T>
): number {
  return index < data.length - 1 ? extractKey(data[index + 1]) : currentNextIp
}

interface ipInfo {
  range: [number, number]
  country: string
  region: string
  eu: '0' | '1'
  timezone: string
  city: string
  ll: [number, number]
  metro: number
  area: number
}

async function lookup4(stringifiedIp: string): Promise<ipInfo | null> {
  try {
    const ip = utils.ipStr2Num(stringifiedIp)

    if (Number.isNaN(ip)) {
      throw new Error('IP cannot be NaN')
    }

    let nextIp = utils.ipStr2Num('255.255.255.255')

    const rootData = await readFile<indexFile>('index.json')
    const rootIndex = utils.binarySearch(rootData, ip, utils.identity)

    if (rootIndex === -1) {
      throw new Error('IP not found in the database')
    }

    nextIp = getNextIp(rootData, rootIndex, nextIp, utils.identity)

    const midData = await readFile<indexFile>(`i${rootIndex}.json`)
    const midIndex = utils.binarySearch(midData, ip, utils.identity) + rootIndex * NUMBER_NODES_PER_MIDINDEX
    nextIp = getNextIp(midData, midIndex, nextIp, utils.identity)

    const blockData = await readFile<ipBlockRecord[]>(`${midIndex}.json`)
    const blockIndex = utils.binarySearch(blockData, ip, firstArrayItem)
    const ipData = blockData[blockIndex]

    if (ipData[1] == null) {
      throw new Error("IP doesn't have any region or country associated")
    }

    nextIp = getNextIp(blockData, blockIndex, nextIp, firstArrayItem)

    const location = await readLocationRecord(ipData[1])

    return {
      range: [ipData[0], nextIp],
      country: location[0],
      region: location[1],
      eu: location[5],
      timezone: location[4],
      city: location[2],
      ll: [ipData[2], ipData[3]],
      metro: location[3],
      area: ipData[4],
    }
  } catch {
    return null
  }
}

export default {
  lookup: lookup4,
  enableCache,
}
