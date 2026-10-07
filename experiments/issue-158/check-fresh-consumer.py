#!/usr/bin/env python3
"""Check direct version alignment; --strict additionally forbids upstream duplicates."""
import json
import sys

metadata = json.load(open(sys.argv[1], encoding="utf-8"))
expected = {
    "async-tungstenite": "0.35.0",
    "base64": "0.23.1",
    "browser-commander": "0.19.0",
    "reqwest": "0.13.5",
    "scraper": "0.27.0",
    "tower-http": "0.7.1",
    "zip": "8.6.0",
}
packages = {item["id"]: item for item in metadata["packages"]}
nodes = {item["id"]: item for item in metadata["resolve"]["nodes"]}
capture = next(item for item in packages.values() if item["name"] == "web-capture")
consumer = packages[metadata["resolve"]["root"]]
duplicates = []
for name, latest in expected.items():
    direct_ids = []
    for root in (capture, consumer):
        dependency = next(
            packages[edge["pkg"]]
            for edge in nodes[root["id"]]["deps"]
            if packages[edge["pkg"]]["name"] == name
        )
        assert dependency["version"] == latest, (
            f"{root['name']} uses {name} {dependency['version']}, expected {latest}"
        )
        direct_ids.append(dependency["id"])
    assert direct_ids[0] == direct_ids[1], f"{name}: direct requirements did not unify"
    versions = {item["version"] for item in packages.values() if item["name"] == name}
    print(f"{name}: both direct requirements share {latest}; graph versions {sorted(versions)}")
    if versions != {latest}:
        duplicates.append(name)
        for dependency in packages.values():
            if dependency["name"] == name and dependency["version"] != latest:
                parents = [
                    f"{packages[node['id']]['name']} {packages[node['id']]['version']}"
                    for node in nodes.values()
                    if dependency["id"] in node["dependencies"]
                ]
                print(f"  upstream {dependency['version']} required by {', '.join(parents)}")
if duplicates:
    print(f"Upstream duplicates remain: {', '.join(duplicates)}")
    if "--strict" in sys.argv[2:]:
        sys.exit(1)
