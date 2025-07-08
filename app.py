from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, render_template_string, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os, json

app = Flask(__name__)
app.secret_key = os.environ.get('APP_SECRET_KEY', 'default_secret_key')

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

creds_json = os.getenv("GOOGLE_CREDENTIALS")

if creds_json:
    creds_dict = json.loads(creds_json)
else:
    with open('credentials.json') as f:
        creds_dict = json.load(f)

creds = service_account.Credentials.from_service_account_info(creds_dict)

service = build('sheets', 'v4', credentials=creds)
sheet = service.spreadsheets()


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
    'อนงค์': '1234567',
    'ศรีธร': '1234567',
    'แต๋ม': '1234567',
    'อ๊อฟ': '1234567',
    'เก่ง': '1234567',
    'เอ๋ย': '1234567'
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

@app.route('/api/phases-zones', methods=['GET'])
def get_phases_zones():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    service = get_service()
    sheet = service.spreadsheets()

    result = sheet.values().get(
        spreadsheetId=TREE_DB_ID,
        range=f"{TREE_SHEET}!A2:D"
    ).execute()

    values = result.get('values', [])

    phases = set()
    phase_to_zones = {}

    for row in values:
        if len(row) < 3:
            continue
        phase = row[0].strip()
        zone = row[2].strip()

        if phase and zone:
            phases.add(phase)
            phase_to_zones.setdefault(phase, set()).add(zone)

    sorted_phases = sorted(list(phases))
    phase_zone_map = {phase: sorted(list(zones)) for phase, zones in phase_to_zones.items()}

    return jsonify({
        "phases": sorted_phases,
        "phaseZoneMap": phase_zone_map
    })


@app.route('/api/tree-ids', methods=['GET'])
def get_tree_ids_and_lines():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    service = get_service()
    sheet = service.spreadsheets()

    tree_result = sheet.values().get(
        spreadsheetId=TREE_DB_ID,
        range=f"{TREE_SHEET}!G2:G"
    ).execute()
    zone_result = sheet.values().get(
        spreadsheetId=TREE_DB_ID,
        range=f"{TREE_SHEET}!C2:C"
    ).execute()
    line_result = sheet.values().get(
        spreadsheetId=TREE_DB_ID,
        range=f"{TREE_SHEET}!D2:D"
    ).execute()

    tree_ids = [row[0].strip().upper() for row in tree_result.get('values', []) if row]
    zones = [row[0].strip() for row in zone_result.get('values', []) if row]
    lines = [row[0].strip() for row in line_result.get('values', []) if row]

    # Build zone => [lines]
    zone_to_lines = {}
    for z, l in zip(zones, lines):
        if z and l:
            zone_to_lines.setdefault(z, set()).add(l)

    # Convert sets to sorted lists
    zone_to_lines = {z: sorted(list(lines)) for z, lines in zone_to_lines.items()}

    return jsonify({
        "treeIDs": list(set(tree_ids)),
        "zoneToLinesMap": zone_to_lines
    })

@app.route('/api/activities', methods=['GET'])
def get_activities():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    service = get_service()
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{ACTIVITIES_SHEET}!A2:C"  # <-- Update range to include ID, Name, Description
    ).execute()

    rows = result.get('values', [])
    activities = [
        {
            "id": row[0].strip(),
            "name": row[1].strip(),
            "description": row[2].strip() if len(row) > 2 else ""
        }
        for row in rows if len(row) >= 2 and row[0].strip() and row[1].strip()
    ]

    return jsonify(activities)


@app.route('/api/submenus/<activity_id>', methods=['GET'])
def get_submenus(activity_id):
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    if not activity_id.strip().isalnum():
        return jsonify([])

    service = get_service()
    sheet = service.spreadsheets()

    result = sheet.values().get(
        spreadsheetId=DAILY_LOGGER_ID,
        range='SubMenu!A2:G'
    ).execute()


    submenus = []
    for row in result.get('values', []):
        if len(row) < 7:
            continue
    
        if row[1].strip() == str(activity_id):
            submenus.append({
                'subNum': row[2].strip(),
                'question': row[3].strip(),
                'questionEng': row[4].strip(),
                'desc': row[5].strip(),
                'descEng': row[6].strip()
            })


    return jsonify(submenus)


@app.route('/api/submit', methods=['POST'])
def submit_log():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    worker = data.get('workerName') or data.get('worker')
    date = data.get('logDate') or data.get('date')
    activities = data.get('activities', [])
    locations = data.get('locations', [])
    submenus = data.get('submenus', {})

    if not worker or not date or not activities or not locations:
        return jsonify({'error': 'Missing required fields: workerName, logDate, activities, locations'}), 400

    values_to_append = []

    # Build rows for DailyLog (all activities, unchanged)
    for loc in locations:
        phase = loc.get('phase', '')
        zone = loc.get('zone', '')
        line = loc.get('line', '')
        treeID = loc.get('treeID', '')

        for activity in activities:
            act_id = str(activity.get('id', ''))
            act_name = activity.get('name', '')

            row = [
                date,
                worker,
                phase,
                zone,
                line,
                treeID,
                act_name
            ]
            values_to_append.append(row)

    service = get_service()
    sheet_service = service.spreadsheets()

    # Append all activities to DailyLog (original logic, untouched)
    sheet_service.values().append(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{LOG_SHEET}!A1",
        valueInputOption="RAW",
        body={"values": values_to_append}
    ).execute()

    treecare_rows = []
    for loc in locations:
        treeID = loc.get('treeID', '')

        treecare_row = [
            date,                                       # A: Date
            worker,                                     # B: Worker Name
            treeID,                                     # C: Tree ID

            submenus.get('submenu-1.1', ''),            # D: Watering Duration
            submenus.get('submenu-1.2', ''),            # E: Notes

            submenus.get('submenu-6.1', ''),            # F: Tree Problem
            submenus.get('submenu-6.2', ''),            # G: Problem Details
            submenus.get('submenu-6.3', ''),            # H: Sample Submitted
            submenus.get('submenu-6.4', ''),            # I: Corrective Action

            submenus.get('submenu-8.1', ''),            # J: Tree Trimming Code
            submenus.get('submenu-8.2', ''),            # K: Other Workers
            submenus.get('submenu-8.3', ''),            # L: Trimming Duration
            submenus.get('submenu-8.4', '')             # M: Observations
        ]

        treecare_rows.append(treecare_row)



    if treecare_rows:
        sheet_service.values().append(
            spreadsheetId=DAILY_LOGGER_ID,
            range="TreeCare!A1",
            valueInputOption="RAW",
            body={"values": treecare_rows}
        ).execute()

    return jsonify({"status": "success", "savedDailyLog": len(values_to_append), "savedTreeCare": len(treecare_rows)})


@app.route('/admin/view-log')
def admin_view_log():
    if 'username' not in session:
        return redirect('/login')

    if session['username'] != 'admin':
        return "Access denied", 403

    sheet_name = request.args.get('sheet', 'DailyLog')  # 'DailyLog' or 'TreeCare'
    sort_by = request.args.get('sort_by', 'Date')

    SHEET_MAP = {
        'DailyLog': {
            'range': 'DailyLog!A1:I',
            'column_map': {
                'Date': 0,
                'WorkerName': 1,
                'Phase': 2,
                'Zone': 3,
                'Line': 4,
                'TreeID': 5,
                'Activity': 6,
                'Duration': 7,
                'Notes': 8
            }
        },
        'TreeCare': {
            'range': 'TreeCare!A1:M',
            'column_map': {
                'Date': 0,
                'Worker Name': 1,
                'TreeID': 2,
                'Watering Duration': 3,
                'Notes': 4,
                'Tree Problem': 5,
                'Problem Details': 6,
                'Sample Submitted': 7,
                'Corrective Action': 8,
                'Tree Trimming Code': 9,
                'Other Workers': 10,
                'Trimming Duration': 11,
                'Observations': 12
            }
        }
    }

    if sheet_name not in SHEET_MAP:
        return "Invalid sheet name", 400

    sheet_config = SHEET_MAP[sheet_name]

    service = get_service()
    sheet = service.spreadsheets()
    result = sheet.values().get(
        spreadsheetId=DAILY_LOGGER_ID,
        range=sheet_config['range']
    ).execute()

    data = result.get('values', [])
    if not data:
        return f"No data found in {sheet_name}.", 404

    # Normalize rows
    max_len = len(data[0])
    for i in range(len(data)):
        while len(data[i]) < max_len:
            data[i].append('')

    headers = data[0]
    rows = data[1:]
    col_map = sheet_config['column_map']

    def format_date_yyyymmdd_to_ddmmyyyy(date_str):
        parts = date_str.split('/')
        if len(parts) == 3:
            yyyy, mm, dd = parts
            return f"{dd}/{mm}/{yyyy}"
        return date_str

    def parse_date_yyyymmdd(date_str):
        parts = date_str.split('/')
        if len(parts) == 3:
            try:
                return tuple(map(int, parts))
            except ValueError:
                return None
        return None

    # Perform sorting
    if sort_by in col_map:
        idx = col_map[sort_by]
        if sort_by == 'Date':
            rows.sort(key=lambda x: parse_date_yyyymmdd(x[idx]) or (0, 0, 0))
        else:
            rows.sort(key=lambda x: x[idx].lower() if idx < len(x) else "")

    # Reformat dates in first column
    for row in rows:
        if row and row[0]:
            row[0] = format_date_yyyymmdd_to_ddmmyyyy(row[0])

    return render_template('view_log.html', headers=headers, rows=rows, sort_by=sort_by, sheet_name=sheet_name)


if __name__ == '__main__':
    app.run(debug=True)
