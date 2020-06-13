var mymap = L.map("map").setView([50.000, 13.000], 13);

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/13/50/13?access_token=pk.eyJ1IjoibjN0dHgiLCJhIjoiY2thdjV6ZHk0MDhtazMzcGNoYTl1cHUwYyJ9.zah7JmDF59WE2UQOcdq98w', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox/streets-v11',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: 'pk.eyJ1IjoibjN0dHgiLCJhIjoiY2thdjV6ZHk0MDhtazMzcGNoYTl1cHUwYyJ9.zah7JmDF59WE2UQOcdq98w'
}).addTo(mymap);