from flask import Flask, request, jsonify, send_from_directory
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os

app = Flask(__name__)
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Setup credentials
SERVICE_ACCOUNT_FILE = 'credentials.json' 
creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Sheet IDs
DAILY_LOGGER_ID = '1Nao5N_jvnBcCZTwWwoWPZPpK9vB4w-ajn2MVLG79C3U'
TREE_DB_ID = '1-L2izXLfLDq-JMQ4Z_h0svSYVqSlB-V77HyaWaFqWKE'

# Sheet Names
WORKER_SHEET = 'WorkerNames'
LOG_SHEET = 'DailyLog'
TREE_SHEET = 'CleanedSheet1'
ACTIVITIES_SHEET = 'Activities'


def get_service():
    return build('sheets', 'v4', credentials=creds)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    # serve static files from the 'static' folder
    return send_from_directory('static', path)

@app.route('/api/worker-names', methods=['GET'])
def get_worker_names():
    service = get_service()
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{WORKER_SHEET}!A2:A"
    ).execute()
    names = [row[0] for row in result.get('values', []) if row]
    return jsonify(names)


@app.route('/api/tree-ids', methods=['GET'])
def get_tree_ids_and_lines():
    service = get_service()
    sheet = service.spreadsheets()

    # Get Tree IDs from Column E
    tree_result = sheet.values().get(
        spreadsheetId=TREE_DB_ID,
        range=f"{TREE_SHEET}!E2:E"
    ).execute()
    tree_ids = [row[0].strip().upper() for row in tree_result.get('values', []) if row]

    # Get Line Numbers from Column B
    line_result = sheet.values().get(
        spreadsheetId=TREE_DB_ID,
        range=f"{TREE_SHEET}!B2:B"
    ).execute()
    line_numbers = [row[0].strip() for row in line_result.get('values', []) if row]

    return jsonify({
        "treeIDs": list(set(tree_ids)),  # Remove duplicates
        "lines": list(set(line_numbers))  # Remove duplicates
    })

@app.route('/api/activities', methods=['GET'])
def get_activities():
    service = get_service()
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{ACTIVITIES_SHEET}!A2:B"
    ).execute()

    rows = result.get('values', [])
    activities = [
        {"name": row[0], "description": row[1] if len(row) > 1 else ""}
        for row in rows if row and row[0].strip()
    ]
    return jsonify(activities)


@app.route('/api/submit', methods=['POST'])
def submit_log():
    data = request.json
    values = [[
        data['date'],
        data['worker'],
        data['phase'],
        data['zone'],
        data['line'],
        data['treeID'],
        ", ".join(data['activities'])
    ]]

    service = get_service()
    sheet = service.spreadsheets()
    sheet.values().append(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{LOG_SHEET}!A1",
        valueInputOption="RAW",
        body={"values": values}
    ).execute()

    return jsonify({"status": "success"})


if __name__ == '__main__':
    app.run(debug=True)
