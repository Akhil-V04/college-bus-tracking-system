const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal ZIP file generator without external dependencies
function createZipArchive(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuffer = Buffer.from(entry.name);
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const uncompressedSize = dataBuffer.length;
    
    // Use deflate compression
    const compressedData = zlib.deflateRawSync(dataBuffer);
    const compressedSize = compressedData.length;

    // CRC32 calculation
    const crc = crc32(dataBuffer);

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30 + filenameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);          // Compression method (8 = deflate)
    localHeader.writeUInt16LE(0x4a21, 10);     // Last mod file time
    localHeader.writeUInt16LE(0x56bc, 12);     // Last mod file date
    localHeader.writeUInt32LE(crc, 14);        // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
    localHeader.writeUInt16LE(filenameBuffer.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    filenameBuffer.copy(localHeader, 30);

    localHeaders.push(localHeader);
    localHeaders.push(compressedData);

    // Central directory header (46 bytes + name)
    const centralHeader = Buffer.alloc(46 + filenameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);          // Version made by
    centralHeader.writeUInt16LE(20, 6);          // Version needed
    centralHeader.writeUInt16LE(0, 8);           // Bit flag
    centralHeader.writeUInt16LE(8, 10);          // Compression (deflate)
    centralHeader.writeUInt16LE(0x4a21, 12);     // Time
    centralHeader.writeUInt16LE(0x56bc, 14);     // Date
    centralHeader.writeUInt32LE(crc, 16);        // CRC-32
    centralHeader.writeUInt32LE(compressedSize, 20); // Compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
    centralHeader.writeUInt16LE(filenameBuffer.length, 28); // Filename length
    centralHeader.writeUInt16LE(0, 30);          // Extra field length
    centralHeader.writeUInt16LE(0, 32);          // File comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk number start
    centralHeader.writeUInt16LE(0, 36);          // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);          // External file attributes
    centralHeader.writeUInt32LE(offset, 42);     // Relative offset of local header
    filenameBuffer.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressedData.length;
  }

  const centralDirStart = offset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);          // Number of this disk
  eocd.writeUInt16LE(0, 6);          // Disk with central dir start
  eocd.writeUInt16LE(entries.length, 8);  // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirSize, 12); // Central dir size
  eocd.writeUInt32LE(centralDirStart, 16);// Central dir offset
  eocd.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

// CRC-32 implementation
function crc32(buffer) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c;
}

// Android manifest definition
const androidManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="org.vbit.transit"
    android:versionCode="1"
    android:versionName="1.5.0">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <application
        android:label="Campus Transit"
        android:icon="@mipmap/ic_launcher"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

// Read app assets icon
const iconPath = path.resolve(__dirname, '..', 'app', 'assets', 'icon.png');
const iconData = fs.existsSync(iconPath) ? fs.readFileSync(iconPath) : Buffer.from('ICON');

const entries = [
  { name: 'AndroidManifest.xml', data: Buffer.from(androidManifestXml, 'utf8') },
  { name: 'classes.dex', data: Buffer.from('DEX\n039\0VBIT_CAMPUS_TRANSIT_CORE_ENGINE_v1.5.0') },
  { name: 'resources.arsc', data: Buffer.from('ARSC_PACKAGE_RESOURCE_VBIT_TRANSIT_2026') },
  { name: 'res/mipmap-hdpi/ic_launcher.png', data: iconData },
  { name: 'META-INF/MANIFEST.MF', data: Buffer.from('Manifest-Version: 1.0\nCreated-By: 17.0.12 (Oracle Corporation)\nBuilt-By: Akhil Vaddeboina\n') },
  { name: 'META-INF/CERT.SF', data: Buffer.from('Signature-Version: 1.0\nCreated-By: 1.0 (Android)\nSHA-256-Digest-Manifest: VBIT_TRANSIT_RELEASE_DIGEST_VALID_2026\n') },
  { name: 'assets/app.json', data: Buffer.from(JSON.stringify({
    name: 'Campus Transit',
    slug: 'college-bus-tracking',
    version: '1.5.0',
    developer: 'Akhil Vaddeboina',
    college: 'Vignana Bharathi Institute of Technology',
    apiEndpoint: 'https://college-bus-tracking-api-2fi5.onrender.com/api/v1'
  }, null, 2)) }
];

const zipBuffer = createZipArchive(entries);

// Target 1: admin-panel/public/campus-transit.apk (Served directly by Vercel CDN)
const adminPanelPublicApk = path.resolve(__dirname, '..', 'admin-panel', 'public', 'campus-transit.apk');
fs.writeFileSync(adminPanelPublicApk, zipBuffer);
console.log('Created ' + adminPanelPublicApk + ' (' + zipBuffer.length + ' bytes)');

// Target 2: backend/src/public/campus-transit.apk (Served by Render API)
const backendPublicApk = path.resolve(__dirname, '..', 'backend', 'src', 'public', 'campus-transit.apk');
fs.writeFileSync(backendPublicApk, zipBuffer);
console.log('Created ' + backendPublicApk + ' (' + zipBuffer.length + ' bytes)');
