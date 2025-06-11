from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, render_template_string, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os, json

app = Flask(__name__)
app.secret_key = os.environ.get('APP_SECRET_KEY', 'default_secret_key')

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Load JSON content from environment variable
service_account_info = json.loads(os.environ['GOOGLE_CREDENTIALS'])
creds = service_account.Credentials.from_service_account_info(
    service_account_info, scopes=SCOPES)

# Sheet IDs
DAILY_LOGGER_ID = '1Nao5N_jvnBcCZTwWwoWPZPpK9vB4w-ajn2MVLG79C3U'
TREE_DB_ID = '1-L2izXLfLDq-JMQ4Z_h0svSYVqSlB-V77HyaWaFqWKE'

# Sheet Names
WORKER_SHEET = 'WorkerNames'
LOG_SHEET = 'DailyLog'
TREE_SHEET = 'CleanedSheet1'
ACTIVITIES_SHEET = 'Activities'

# Admin/User credentials
USERS = {
    'admin': 'admina44',
    'test': 'testa44',
    'Nong': 'nonga44',
    'Srithon': 'srithona44',
    'Thaen': 'thaena44'
}

def get_service():
    return build('sheets', 'v4', credentials=creds)

@app.route('/static/<path:path>')
def public_static(path):
    return send_from_directory('static', path)

@app.route('/')
def home():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', username=session['username'], USERS=USERS)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username in USERS and USERS[username] == password:
            session['username'] = username
            return redirect(url_for('home'))
        return 'Invalid credentials', 401
    return send_from_directory('static', 'login.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))

@app.route('/<path:path>')
def static_proxy(path):
    if 'username' not in session:
        return redirect(url_for('login'))
    return send_from_directory('static', path)

@app.route('/api/worker-names', methods=['GET'])
def get_worker_names():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
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
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
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
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
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
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
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

@app.route('/admin/view-log')
def admin_view_log():
    if 'username' not in session:
        return redirect('/login')
    
    if session['username'] != 'admin':
        return "Access denied", 403

    service = get_service()
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{LOG_SHEET}!A1:G"  # Adjust columns as needed
    ).execute()
    
    data = result.get('values', [])
    return render_template('view_log.html', sheet_data=data)


if __name__ == '__main__':
    app.run(debug=True)
