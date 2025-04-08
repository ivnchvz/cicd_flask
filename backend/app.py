from flask import Flask, render_template
from flask_socketio import SocketIO
from flask_cors import CORS
import requests
import time
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Allow CORS for Docker and local testing
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

def fetch_iss_data():
    try:
        iss_response = requests.get("https://api.wheretheiss.at/v1/satellites/25544", timeout=5)
        if iss_response.ok:
            iss_data = iss_response.json()
            lat = iss_data.get("latitude")
            lon = iss_data.get("longitude")
            coord_url = f"https://api.wheretheiss.at/v1/coordinates/{lat},{lon}?indent=4"
            coord_response = requests.get(coord_url, timeout=5)
            if coord_response.ok:
                coord_data = coord_response.json()
                country_code = coord_data.get("country_code", "N/A")
            else:
                logger.warning("Coordinates API failed: %s", coord_response.text)
                country_code = "N/A"
            return {
                "latitude": lat,
                "longitude": lon,
                "country_code": country_code
            }
        else:
            logger.error("ISS API failed: %s", iss_response.text)
            return {"error": "Error fetching ISS position"}
    except Exception as e:
        logger.error("Exception in fetch_iss_data: %s", str(e))
        return {"error": str(e)}

def background_thread():
    while True:
        data = fetch_iss_data()
        logger.info("Emitting ISS data: %s", data)
        socketio.emit('iss_update', data)
        time.sleep(1)

@app.route("/")
def index():
    return render_template("index.html")

@socketio.on('connect')
def handle_connect(auth=None):
    logger.info("Client connected")
    socketio.start_background_task(background_thread)

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected")