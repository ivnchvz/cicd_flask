from flask import Flask, render_template
from flask_socketio import SocketIO
from flask_cors import CORS
import requests
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'

# Allow CORS for the frontend origin
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000")

def fetch_iss_data():
    try:
        # Fetch the current ISS position
        iss_response = requests.get("https://api.wheretheiss.at/v1/satellites/25544")
        if iss_response.ok:
            iss_data = iss_response.json()
            lat = iss_data.get("latitude")
            lon = iss_data.get("longitude")
            # Now use the coordinates endpoint to get location details (e.g., country_code)
            coord_url = f"https://api.wheretheiss.at/v1/coordinates/{lat},{lon}?indent=4"
            coord_response = requests.get(coord_url)
            if coord_response.ok:
                coord_data = coord_response.json()
                country_code = coord_data.get("country_code", "N/A")
            else:
                country_code = "N/A"
            return {
                "latitude": lat,
                "longitude": lon,
                "country_code": country_code
            }
        else:
            return {"error": "Error fetching ISS position"}
    except Exception as e:
        return {"error": str(e)}

def background_thread():
    # Continuously fetch ISS data and emit updates every second
    while True:
        data = fetch_iss_data()
        socketio.emit('iss_update', data)
        time.sleep(1)

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on('connect')
def handle_connect():
    print("Client connected")
    # Start the background task on client connection
    socketio.start_background_task(background_thread)

@socketio.on('disconnect')
def handle_disconnect():
    print("Client disconnected")

if __name__ == "__main__":
    socketio.run(app, debug=True)
