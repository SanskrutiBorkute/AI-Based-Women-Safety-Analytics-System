import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib

# Load dataset
df = pd.read_csv("data/crime_data.csv")

# Features
X = df[["hour", "crime_rate", "crowd_density"]]

# Target
y = df["safety"]

# Train model
model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X, y)

# Save model
joblib.dump(
    model,
    "models/safety_model.pkl"
)

print("AI Safety Model Trained Successfully")