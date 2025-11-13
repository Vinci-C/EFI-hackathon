import json
import requests

# Download the original data file
url = "http://files.datathistle.com/feeds/edinburghfuturesinstitute/sample_edinburgh_glasgow_july_august_2025.json"
response = requests.get(url)
data = response.json()

# Create a dictionary for places
places = {place['place_id']: place for place in data['places']}

# Create the new data structure
output_data = {"events": []}
for event in data['events']:
    for schedule in event.get('schedules', []):
        place_id = schedule.get('place_id')
        if place_id:
            place = places.get(place_id)
            if place and "Edinburgh" in place.get('town', ''):
                output_data["events"].append({
                    "id": event["id"],
                    "name": event["name"],
                    "category": event["category"],
                    "venue_name": place["name"],
                    "coords": [float(place["loc"]["latitude"]), float(place["loc"]["longitude"])],
                    "start_ts": schedule["start_ts"],
                })

# Save the new data.json file
with open("frontend/public/data.json", "w") as f:
    json.dump(output_data, f, indent=2)

print("data.json file created successfully with Edinburgh events.")