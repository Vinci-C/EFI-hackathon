import json
import os

def filter_and_process_events(input_filepath):
    """
    Filters events from a JSON file for Edinburgh, extracts specific fields,
    and removes duplicates based on event_id.
    """
    filtered_events = []
    seen_event_ids = set()

    try:
        with open(input_filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"Type of loaded data: {type(data)}")
        if isinstance(data, list):
            print(f"First 5 elements of data: {data[:5]}")
        elif isinstance(data, dict):
            print(f"Keys of data: {data.keys()}")
        else:
            print(f"Loaded data (truncated): {str(data)[:500]}...")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_filepath}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from {input_filepath}. Details: {e}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred during file loading: {e}")
        return []

    for event in data.get('events', []): # Access the 'events' list from the dictionary
        event_id = event.get('id') # Assuming 'id' is the event_id
        if event_id is None:
            continue

        if event_id in seen_event_ids:
            continue # Skip duplicate

        # Check if the event has schedules and a place
        if 'schedules' in event and event['schedules']:
            # Assuming the first schedule contains the relevant place info
            first_schedule = event['schedules'][0]
            place = first_schedule.get('place')

            if place and place.get('town') == 'Edinburgh':
                venue_name = place.get('name')
                start_ts = first_schedule.get('start_ts')
                end_ts = first_schedule.get('end_ts')

                capacity_calculated = None
                # Access schedules, then the first schedule
                first_schedule = event.get('schedules', [{}])[0] # Default to empty dict if schedules is empty
                
                # Access performances, then the first performance
                first_performance = first_schedule.get('performances', [{}])[0] # Default to empty dict if performances is empty
                
                # Access properties, then 'capacity.calculated'
                properties = first_performance.get('properties', {})
                capacity_calculated = properties.get('capacity.calculated')

                processed_event = {
                    'event_id': event_id,
                    'name': event.get('name'),
                    'category': event.get('category'),
                    'venue_name': venue_name,
                    'start_ts': start_ts,
                    'end_ts': end_ts,
                    'capacity_calculated': capacity_calculated,
                    # 'coords': None, # Not present in example, omitting for now
                }
                filtered_events.append(processed_event)
                seen_event_ids.add(event_id)

    return filtered_events

if __name__ == "__main__":
    # Construct the path to the input JSON file
    # Assuming the script is run from the project root or 'own/' directory
    script_dir = os.path.dirname(__file__)
    input_json_path = os.path.join(script_dir, '..', 'Data Thistle (All Events)', 'sample_edinburgh_glasgow_july_august_2025.json')
    
    # Adjust path if running from project root
    if not os.path.exists(input_json_path):
        input_json_path = os.path.join(os.getcwd(), 'Data Thistle (All Events)', 'sample_edinburgh_glasgow_july_august_2025.json')


    processed_data = filter_and_process_events(input_json_path)

    if processed_data:
        print(f"Found {len(processed_data)} unique Edinburgh events.")
        # Optionally, save the filtered data to a new JSON file
        output_filename = "edinburgh_events.json"
        output_filepath = os.path.join(script_dir, output_filename)
        with open(output_filepath, 'w', encoding='utf-8') as outfile:
            json.dump(processed_data, outfile, indent=4)
        print(f"Filtered data saved to {output_filepath}")
    else:
        print("No events found or processed.")
