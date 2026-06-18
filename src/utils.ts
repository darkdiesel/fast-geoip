type extractKeyFunction<T> = (record: T) => number

export function identity(item: number): number {
  return item
}

export function binarySearch<T>(
  list: T[],
  item: number,
  extractKey: extractKeyFunction<T>
): number {
  let low = 0
  let high = list.length - 1

  while (true) {
    const i = Math.round((high - low) / 2) + low
    const key = extractKey(list[i])

    if (item < key) {
      if (i === high && i === low) return -1
      high = i === high ? low : i
    } else if (i === list.length - 1 || item < extractKey(list[i + 1])) {
      return i
    } else {
      low = i
    }
  }
}

export function ipStr2Num(stringifiedIp: string): number {
  return stringifiedIp
    .split('.')
    .map(Number)
    .reduce((acc, val, index) => acc + val * 256 ** (3 - index), 0)
}

export default { binarySearch, identity, ipStr2Num }
