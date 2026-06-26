import csv
import random

# Generate a larger crime dataset
records = []
header = ["hour", "crime_rate", "crowd_density", "safety"]

# Generate 1000 records
for i in range(1000):
    hour = random.randint(0, 23)
    
    # Simulate realistic patterns
    if 8 <= hour < 18:
        # Daytime
        crime_rate = random.randint(5, 35)
        crowd_density = random.randint(45, 95)
    elif 18 <= hour < 22:
        # Evening
        crime_rate = random.randint(30, 65)
        crowd_density = random.randint(30, 70)
    else:
        # Late night / early morning (22 to 7)
        crime_rate = random.randint(60, 99)
        crowd_density = random.randint(2, 25)
        
    # Determine safety category based on features
    score = 100 - crime_rate * 0.7 - (100 - crowd_density) * 0.3
    
    if score >= 65:
        safety = "SAFE"
    elif score >= 40:
        safety = "MEDIUM"
    else:
        safety = "UNSAFE"
        
    records.append([hour, crime_rate, crowd_density, safety])

# Write to crime_data.csv
with open("data/crime_data.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(records)

print(f"Generated {len(records)} records in data/crime_data.csv")
