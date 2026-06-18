from dotenv import load_dotenv

load_dotenv()

import urllib.request, os, zipfile, glob, shutil
import processGeoIpCsv as geoip

ZIP_FILENAME = os.environ["MAXMIND_EDITION_ID"] + ".zip"
TEMPORAL_EXTRACTED_DIR = "geoip"


def rmtree(directory):
    shutil.rmtree(directory, ignore_errors=True)


print('Downloading GeoIp database...')
urllib.request.urlretrieve("https://download.maxmind.com/app/geoip_download?edition_id=" + os.environ["MAXMIND_EDITION_ID"] + "&suffix=zip&license_key=" + os.environ["MAXMIND_LICENSE_KEY"],
                           os.path.join(geoip.DATABASE_DIR, ZIP_FILENAME))

print('Extracting GeoIp database...')
with zipfile.ZipFile(os.path.join(geoip.DATABASE_DIR, ZIP_FILENAME), 'r') as zip_ref:
    zip_ref.extractall(TEMPORAL_EXTRACTED_DIR)

rmtree(geoip.RAW_DATABASE_DIR)

extracted_dir = glob.glob(os.path.join(TEMPORAL_EXTRACTED_DIR, os.environ["MAXMIND_EDITION_ID"] + '_[0-9]*'))[0]

os.rename(extracted_dir, os.path.join(geoip.RAW_DATABASE_DIR))

rmtree(TEMPORAL_EXTRACTED_DIR)
print('New database ready for processing')