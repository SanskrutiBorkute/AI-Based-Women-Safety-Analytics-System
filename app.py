from flask import Flask, render_template, jsonify
import joblib
from datetime import datetime

app = Flask(__name__)

model = joblib.load("models/safety_model.pkl")

@app.route("/")
def dashboard():
    return render_template("dashboard.html")

@app.route("/predict")
def predict():

    current_hour = datetime.now().hour

    crime_rate = 60
    crowd_density = 40

    prediction = model.predict(
        [[current_hour, crime_rate, crowd_density]]
    )[0]

    if prediction == "SAFE":
        score = 92
        confidence = 96

    elif prediction == "MEDIUM":
        score = 63
        confidence = 82

    else:
        score = 18
        confidence = 91

    return jsonify({
        "safety": prediction,
        "score": score,
        "confidence": confidence
    })

if __name__ == "__main__":
    app.run(debug=True)