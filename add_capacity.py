import json

def create_capacity_mapping():
    """
    Reads the original large JSON data file and creates a mapping
    from event_id to its calculated capacity.
    """
    capacity_map = {}
    original_data_path = '../Data Thistle (All Events)/sample_edinburgh_glasgow_july_august_2025.json'
    
    print("Starting to read original data file to create capacity mapping...")
    with open(original_data_path, 'r') as f:
        original_data = json.load(f)

    for original_event in original_data.get('events', []):
        event_id = original_event.get('id')
        if not event_id:
            continue

        capacity = None
        if 'schedules' in original_event:
            for schedule in original_event['schedules']:
                if 'performances' in schedule:
                    for performance in schedule['performances']:
                        if 'properties' in performance and 'capacity.calculated' in performance['properties']:
                            capacity = performance['properties']['capacity.calculated']
                            if capacity:
                                break
                if capacity:
                    break
        
        if capacity:
            capacity_map[event_id] = capacity

    print(f"Finished reading original data file. Found capacities for {len(capacity_map)} events.")
    return capacity_map

def update_data_with_capacity(capacity_map):
    """
    Reads the existing data.json, updates events with capacity information,
    and writes the updated data back to the file.
    """
    processed_data_path = 'frontend/public/data.json'
    
    print(f"Reading {processed_data_path} to update with capacity...")
    with open(processed_data_path, 'r') as f:
        processed_data = json.load(f)

    updated_count = 0
    for event in processed_data.get('events', []):
        event_id = event.get('id')
        if event_id in capacity_map:
            event['capacity_calculated'] = capacity_map[event_id]
            updated_count += 1

    print(f"Updated {updated_count} events with capacity information.")

    print(f"Writing updated data back to {processed_data_path}...")
    with open(processed_data_path, 'w') as f:
        json.dump(processed_data, f, indent=2)
    print("Successfully updated data.json.")

if __name__ == "__main__":
    capacity_mapping = create_capacity_mapping()
    if capacity_mapping:
        update_data_with_capacity(capacity_mapping)
    else:
        print("No capacity information found in the original data file. No updates made.")