import urllib.request, json
data = json.loads(urllib.request.urlopen('https://nodejs.org/dist/index.json').read())
lts = next(d for d in data if d.get('lts'))
version = lts["version"]
print(f"LTS: {version}")

# Download MSI installer
url = f"https://nodejs.org/dist/{version}/node-{version}-x64.msi"
print(f"Downloading: {url}")
dest = "C:/Users/anjan/Downloads/node_lts.msi"
urllib.request.urlretrieve(url, dest, lambda b, bs, s: print(f"\r{b*bs*100//s}%", end="", flush=True) if s > 0 else None)
print(f"\nSaved to: {dest}")
