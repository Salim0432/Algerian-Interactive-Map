from django.http import JsonResponse
from django.shortcuts import render


def map_page(request):
    return render(request, "mapapp/index.html")


def summary(request):
    return JsonResponse(
        {
            "wilaya_count": 69,
            "daira_count": 551,
            "commune_count": 1541,
            "law": "Law 26-06, April 4, 2026",
            "law_publication": "Official Journal No. 25, April 5, 2026",
            "wilaya_catalog_updated": "2026-08-21",
            "wilaya_boundaries_retrieved": "2026-06-21",
            "commune_boundary_snapshots": [
                "2026-10-24T13:54:21Z",
                "2026-10-24T13:56:21Z",
            ],
            "osm_commune_boundary_count": 1540,
            "legacy_commune_boundary_count": 1,
            "source": "GeoAlgeria dataset; OpenStreetMap-derived wilaya boundaries",
            "source_url": "https://github.com/yasserstudio/geoalgeria/tree/e07e0290e1aebebb9d8fc4a959d37ee5d2991087/packages/dataset",
            "licenses": {
                "wilayas": "Open Database License 1.0; © OpenStreetMap contributors",
                "communes": (
                    "1,540 OpenStreetMap-derived commune polygons are Open Database License 1.0; "
                    "one geoBoundaries polygon is Creative Commons Attribution-ShareAlike 2.0"
                ),
            },
            "commune_geometry": "1541 commune boundary polygons",
        }
    )
