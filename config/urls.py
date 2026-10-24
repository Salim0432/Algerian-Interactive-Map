from django.urls import path

from mapapp import views


urlpatterns = [
    path("", views.map_page, name="map"),
    path("api/summary/", views.summary, name="summary"),
]
