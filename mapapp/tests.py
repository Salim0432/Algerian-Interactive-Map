import json
from collections import Counter
from pathlib import Path

from django.test import TestCase
from django.urls import reverse


class MapPageTests(TestCase):
    def test_map_page_renders(self):
        response = self.client.get(reverse("map"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Algeria Atlas")
        self.assertContains(response, "69 wilayas")
        self.assertContains(response, "real commune boundary shapes")
        self.assertContains(response, "algeria-commune-polygons.geojson")
        self.assertContains(response, "Data & sources")
        self.assertContains(response, '<details class="source-note">')
        self.assertContains(response, 'id="display-language"')
        self.assertContains(response, 'id="sort-order"')

    def test_summary_counts_match_boundary_files(self):
        data_dir = Path(__file__).resolve().parent.parent / "static" / "data"
        with (data_dir / "algeria-wilayas-69.geojson").open(encoding="utf-8") as source:
            wilayas = json.load(source)["features"]
        with (data_dir / "algeria-commune-polygons.geojson").open(encoding="utf-8") as source:
            communes = json.load(source)["features"]
        with (data_dir / "algeria-wilaya-records.json").open(encoding="utf-8") as source:
            records = json.load(source)["wilayas"]

        response = self.client.get(reverse("summary"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["wilaya_count"], len(wilayas))
        self.assertEqual(response.json()["commune_count"], len(communes))
        self.assertEqual(
            response.json()["daira_count"],
            sum(record["dairas_count"] for record in records),
        )
        self.assertEqual(response.json()["law"], "Law 26-06, April 4, 2026")
        self.assertEqual(response.json()["commune_geometry"], "1541 commune boundary polygons")
        self.assertEqual(len(records), 69)
        self.assertEqual(
            {int(feature["properties"]["code"]) for feature in wilayas},
            {int(record["code"]) for record in records},
        )
        self.assertEqual(
            {int(feature["properties"]["wilaya_code"]) for feature in communes},
            {int(record["code"]) for record in records},
        )
        self.assertTrue(
            all(feature["geometry"]["type"] in {"Polygon", "MultiPolygon"} for feature in communes)
        )
        self.assertTrue(
            all(
                len(ring) >= 4 and ring[0] == ring[-1]
                for feature in communes
                for polygon in (
                    feature["geometry"]["coordinates"]
                    if feature["geometry"]["type"] == "MultiPolygon"
                    else [feature["geometry"]["coordinates"]]
                )
                for ring in polygon
            )
        )
        self.assertEqual(
            sum(feature["properties"]["boundary_source"].startswith("geoBoundaries") for feature in communes),
            response.json()["legacy_commune_boundary_count"],
        )
        commune_counts = Counter(int(feature["properties"]["wilaya_code"]) for feature in communes)
        self.assertTrue(
            all(commune_counts[int(record["code"])] == record["communes_count"] for record in records)
        )
