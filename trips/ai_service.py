import time

def generate_packing_list(destination_name, duration_days):
    """
    Mock AI implementation to generate a packing list based on destination.
    In the future, this will call OpenAI/Gemini APIs.
    """
    # Simulate API delay
    time.sleep(1.5)
    
    # Generic mock response
    base_items = ["Passport", "Phone Charger", "Toothbrush", "Underwear", "Socks"]
    
    if "beach" in destination_name.lower() or "hawaii" in destination_name.lower():
        return base_items + ["Swimsuit", "Sunscreen", "Sunglasses", "Flip flops"]
    elif "ski" in destination_name.lower() or "alps" in destination_name.lower():
        return base_items + ["Winter Coat", "Thermals", "Gloves", "Ski goggles"]
    else:
        return base_items + ["Comfortable walking shoes", "Jacket", "Camera"]

def predict_budget(destination_name, duration_days):
    """
    Mock AI implementation to predict the total budget.
    """
    time.sleep(1.0)
    
    # Simple heuristic
    daily_cost = 150 # default
    if "tokyo" in destination_name.lower() or "london" in destination_name.lower():
        daily_cost = 250
    elif "bali" in destination_name.lower() or "vietnam" in destination_name.lower():
        daily_cost = 60
        
    return daily_cost * max(1, duration_days)
