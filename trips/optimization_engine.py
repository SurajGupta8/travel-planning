import math
from datetime import timedelta, datetime, date

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    Returns distance in kilometers.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 0.0

    # Convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r

def estimate_travel_time_minutes(distance_km):
    """
    Rough estimation of travel time: assume average speed of 30 km/h in a city.
    """
    speed_kmh = 30.0
    return (distance_km / speed_kmh) * 60

def optimize_schedule(activities, day_start_time):
    """
    activities: List of Activity model instances.
    day_start_time: datetime object representing when the day starts.
    
    Returns a list of activities with updated start_time and end_time, 
    sorted in the optimal order.
    """
    if not activities:
        return []

    unassigned = list(activities)
    current_time = day_start_time
    current_lat = None
    current_lon = None
    
    ordered_activities = []
    
    while unassigned:
        best_next = None
        best_score = float('inf')
        
        for candidate in unassigned:
            # Calculate transit time
            dist = 0
            if current_lat is not None and current_lon is not None and candidate.latitude and candidate.longitude:
                dist = haversine_distance(current_lat, current_lon, candidate.latitude, candidate.longitude)
                
            transit_mins = estimate_travel_time_minutes(dist)
            arrival_time = current_time + timedelta(minutes=transit_mins)
            
            # Check opening hours constraint
            wait_time = timedelta(0)
            if candidate.opening_time:
                opening_dt = datetime.combine(current_time.date(), candidate.opening_time)
                if arrival_time < opening_dt:
                    wait_time = opening_dt - arrival_time
                    arrival_time = opening_dt
                    
            # Check closing hours constraint
            if candidate.closing_time:
                closing_dt = datetime.combine(current_time.date(), candidate.closing_time)
                duration = timedelta(minutes=candidate.duration_minutes)
                if arrival_time + duration > closing_dt:
                    # Huge penalty if it can't fit
                    score = float('inf')
                    continue
            
            score = transit_mins + (wait_time.total_seconds() / 60)
            
            if score < best_score:
                best_score = score
                best_next = candidate
                
        if not best_next:
            best_next = unassigned[0]
            
        unassigned.remove(best_next)
        
        # Calculate final times
        dist = 0
        if current_lat is not None and current_lon is not None and best_next.latitude and best_next.longitude:
            dist = haversine_distance(current_lat, current_lon, best_next.latitude, best_next.longitude)
            
        transit_mins = estimate_travel_time_minutes(dist)
        arrival_time = current_time + timedelta(minutes=transit_mins)
        
        if best_next.opening_time:
            opening_dt = datetime.combine(current_time.date(), best_next.opening_time)
            if arrival_time < opening_dt:
                arrival_time = opening_dt
                
        best_next.start_time = arrival_time
        best_next.end_time = arrival_time + timedelta(minutes=best_next.duration_minutes)
        ordered_activities.append(best_next)
        
        current_time = best_next.end_time
        if best_next.latitude and best_next.longitude:
            current_lat = best_next.latitude
            current_lon = best_next.longitude
            
    return ordered_activities
