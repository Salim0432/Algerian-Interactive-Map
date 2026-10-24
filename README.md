# Algeria Atlas

A Django-powered interactive map focused exclusively on Algeria. It includes all 69 wilayas, 551 daïras, and all 1,541 communes in the bundled dataset. Commune areas are drawn as polygons, not point markers. Selecting a wilaya zooms into it and shows its capital, daïra and commune counts, and establishment year; selecting a commune shows its wilaya, daïra, commune code, and postal code. Compact list options switch names between French and Arabic and sort wilayas alphabetically, by administrative code, or by commune count. The map also includes a north indicator and metric scale. The minimum zoom keeps Algeria filling the map rather than shrinking to a tiny shape.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py runserver
```

Open <http://127.0.0.1:8000/>.

## Data, source, and limitations

The map uses the [GeoAlgeria dataset](https://github.com/yasserstudio/geoalgeria/tree/e07e0290e1aebebb9d8fc4a959d37ee5d2991087/packages/dataset), pinned to commit `e07e0290e1aebebb9d8fc4a959d37ee5d2991087`:

- 69 wilayas, including the 11 created under Law 26-06 (April 4, 2026; published in Official Journal No. 25 on April 5, 2026).
- 1,541 communes, with French and Arabic names and parent wilaya codes.
- Wilaya polygons derived from OpenStreetMap administrative boundaries, retrieved June 21, 2026. These are crowdsourced boundaries, not an official cadastral or legal survey.
- Commune areas are **boundary polygons**, not points. 1,540 commune boundaries are joined to the current commune catalogue by their OpenStreetMap relation IDs and reflect OpenStreetMap snapshots from October 24, 2026 at 13:54–13:56 UTC. One commune, Dhayet Bendhahoua, has no OSM relation ID in the catalogue and uses its available geoBoundaries ADM3 outline (2021) as a fallback.
- OSM shapes are simplified for faster map rendering. Boundaries are crowdsourced geographic outlines, not an official cadastral or legal survey.
- Polygon source counts, licensing, and simplification details are recorded in [the boundary dataset metadata](static/data/algeria-commune-polygons.metadata.json).
- The bundled wilaya catalogue metadata was last updated August 21, 2026.

The administrative list and commune catalogue are MIT-licensed as described in the source repository. OpenStreetMap-derived wilaya and commune boundary polygons are subject to ODbL 1.0 attribution/share-alike terms. The single fallback commune outline comes from geoBoundaries and is licensed CC BY-SA 2.0. See the upstream [NOTICE](https://github.com/yasserstudio/geoalgeria/blob/e07e0290e1aebebb9d8fc4a959d37ee5d2991087/packages/dataset/NOTICE), [wilaya boundary metadata](https://github.com/yasserstudio/geoalgeria/blob/e07e0290e1aebebb9d8fc4a959d37ee5d2991087/packages/dataset/data/geojson/wilaya-boundaries.metadata.json), and [geoBoundaries ADM3 source](https://www.geoboundaries.org/api/current/gbOpen/DZA/ADM3/).

The map intentionally does not load a world basemap or external map tiles; it renders Algeria's wilaya and commune boundary shapes on a plain background.
