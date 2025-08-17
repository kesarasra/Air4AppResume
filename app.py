from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, render_template_string, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os, json, uuid

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
CHEMICALS_SHEET_ID = '1weqqgU3_APV57Gh0dg7wG4DNqKZfQj6Fb027wp-aAaw'


# Sheet Names
WORKER_SHEET = 'WorkerNames'
LOG_SHEET = 'DailyLog'
TREE_SHEET = 'CleanedSheet1'
ACTIVITIES_SHEET = 'Activities'
FORMULAIDS = 'FormuMetadata'
FORMULATIONS = 'Formulations'
EQUIP_SHEET = 'Equipment'
INVENTORY = 'Inventory'
INVENTORY_RANGE = f"{INVENTORY}!A1:U"

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

@app.route('/newitem')
def newitem_page():
    return render_template('newitem.html')


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

@app.route("/api/formulas")
def get_formulas():
    try:
        result = sheet.values().get(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range=f"{FORMULAIDS}!A2:A"  
        ).execute()

        values = result.get("values", [])
        formulas = [ {"id": row[0]} for row in values if row ]

        return jsonify({"formulas": formulas})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/fertilizer-names', methods=['GET'])
def get_fertilizer_names():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        service = get_service()
        sheet = service.spreadsheets()

        result = sheet.values().get(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range='Fertilizers!B2:B'  # Assuming Thai chemical names are in Col B, starting row 2
        ).execute()

        values = result.get('values', [])
        names = [row[0].strip() for row in values if row and row[0].strip()]
        return jsonify(names)

    except Exception as e:
        print(f"❌ ERROR in /api/fertilizer-names: {str(e)}")
        return jsonify({'error': 'Failed to fetch fertilizer names', 'details': str(e)}), 500

@app.route('/api/pesticide-names', methods=['GET'])
def get_pesticide_names():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        service = get_service()
        sheet = service.spreadsheets()

        result = sheet.values().get(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range='Pesticide/Herbicide/Fungicide!B2:B'  # Thai names are in Column B
        ).execute()

        values = result.get('values', [])
        names = [row[0].strip() for row in values if row and row[0].strip()]
        return jsonify(names)

    except Exception as e:
        print("❌ ERROR in /api/chemical-names:", str(e))
        return jsonify({'error': 'Failed to fetch chemical names', 'details': str(e)}), 500

@app.route('/api/equipment', methods=['GET'])
def get_equipment():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        service = get_service()
        sheet = service.spreadsheets()

        # Fetch both columns A and E from Equipment sheet
        result = sheet.values().get(
            spreadsheetId=DAILY_LOGGER_ID,
            range=f"{EQUIP_SHEET}!A2:E"  # A=Code, E=Thai name
        ).execute()

        values = result.get('values', [])
        equipment_list = []

        for row in values:
            code = row[0].strip() if len(row) > 0 and row[0].strip() else None
            th_name = row[4].strip() if len(row) > 4 and row[4].strip() else None

            if code and th_name:
                equipment_list.append(f"{code} - {th_name}")

        return jsonify(equipment_list)

    except Exception as e:
        print("❌ ERROR in /api/equipment:", str(e))
        return jsonify({'error': 'Failed to fetch equipment', 'details': str(e)}), 500


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

    log_id = str(uuid.uuid4())[:8]

    service = get_service()
    sheet_service = service.spreadsheets()

    def unique_preserve_order(seq):
        seen = set()
        return [x for x in seq if not (x in seen or seen.add(x))]

    phases, zones, lines, treeIDs = [], [], [], []

    for loc in locations:
        phase = loc.get('phase', '').strip()
        zone = loc.get('zone', '').strip()
        line = loc.get('line', '').strip()
        treeID = loc.get('treeID', '').strip()

        if phase: phases.append(phase)
        if zone: zones.append(zone)
        if line: lines.append(line)
        if treeID: treeIDs.append(treeID)

    # Remove duplicates but preserve input order
    phases = unique_preserve_order(phases)
    zones = unique_preserve_order(zones)
    lines = unique_preserve_order(lines)
    treeIDs = unique_preserve_order(treeIDs)

    activity_names = [act.get('name', '').strip() for act in activities if act.get('name')]

    daily_log_row = [
        log_id,
        date,
        worker,
        ','.join(phases),
        ','.join(zones),
        ','.join(lines),
        ','.join(treeIDs),
        ','.join(activity_names)
    ]

    # Save to DailyLog
    sheet_service.values().append(
        spreadsheetId=DAILY_LOGGER_ID,
        range=f"{LOG_SHEET}!A1",
        valueInputOption="RAW",
        body={"values": [daily_log_row]}
    ).execute()


    treecare_rows = []

    if any(str(act.get('id')) in ['1', '2', '3', '5'] for act in activities):
        treecare_row = [
            log_id,
            date,
            worker,
            submenus.get('submenu-1.1', ''),  # Watering Duration
            submenus.get('submenu-1.2', ''),  # Start Pressure Gauge
            submenus.get('submenu-1.3', ''),  # End Pressure Gauge
            submenus.get('submenu-1.4', ''),  # Notes
            submenus.get('submenu-2.1', ''),  # Fertilizing Method
            submenus.get('submenu-2.2', ''),  # Other Workers
            submenus.get('submenu-2.3', ''),  # Duration (mins)
            submenus.get('submenu-2.4', ''),  # Fertilizer Formula
            submenus.get('submenu-2.5', ''),  # Part of Tree Applied
            submenus.get('submenu-2.6.1', ''),  # Fertilizer Amount
            submenus.get('submenu-2.6.2', ''),  # Unit in kg or L
            submenus.get('submenu-2.7', ''),  # Equipment
            submenus.get('submenu-2.8', ''),  # Notes
            submenus.get('submenu-3.1', ''),  # Tree Problem
            submenus.get('submenu-3.2', ''),  # Problem Details
            submenus.get('submenu-3.3', ''),  # Severity of Problem (radio buttons)
            submenus.get('submenu-3.4', ''),  # Sample Submitted
            submenus.get('submenu-3.5', ''),  # Corrective Action
            submenus.get('submenu-5.1', ''),  # Tree Trimming Code
            submenus.get('submenu-5.2', ''),  # Other Workers
            submenus.get('submenu-5.3', ''),  # Trimming Duration
            submenus.get('submenu-5.4', '')   # Observations
        ]
        treecare_rows.append(treecare_row)
    
    if treecare_rows:
        sheet_service.values().append(
            spreadsheetId=DAILY_LOGGER_ID,
            range="TreeCare!A2:Y",
            valueInputOption="RAW",
            body={"values": treecare_rows}
        ).execute()

    gardencare_rows = []

    # Prepare placeholders for submenu answers with empty defaults
    gardencare_4_submenus = [''] * 8
    gardencare_10_submenus = [''] * 10

    # Collect submenu data from activities
    for activity in activities:
        if activity.get('id') == '4':
            gardencare_4_submenus = [
                submenus.get('submenu-4.2', ''),   # C: Other Workers
                submenus.get('submenu-4.1', ''),   # D: Activity code
                submenus.get('submenu-4.3', ''),   # E: Equipment
                submenus.get('submenu-4.4', ''),   # F: Duration
                submenus.get('submenu-4.5', ''),   # G: Notes
                submenus.get('submenu-4.6', ''),   # H: Chemical Name
                submenus.get('submenu-4.7.1', ''), # I: Amount Used
                submenus.get('submenu-4.7.2', ''), # J: Unit Type
                submenus.get('submenu-4.8', ''),   # K: Tank Size
            ]
        elif activity.get('id') == '10':
            gardencare_10_submenus = [
                submenus.get('submenu-10.1', ''),  # Detail of Test Site (L)
                submenus.get('submenu-10.2', ''),  # Value #1 (M)
                submenus.get('submenu-10.3', ''),  # Value #2 (N)
                submenus.get('submenu-10.4', ''),  # Value #3 (O)
                submenus.get('submenu-10.5', ''),  # Value #4 (P)
                submenus.get('submenu-10.6', ''),  # Value #5 (Q)
                submenus.get('submenu-10.7', ''),  # Value #6 (R)
                submenus.get('submenu-10.8', ''),  # Value #7 (S)
                submenus.get('submenu-10.9', ''),  # Value #8 (T)
                submenus.get('submenu-10.10', ''), # Notes (U)
            ]

    # Only write if activity 4 or 10 was selected (any submenu field filled)
    if any(cell.strip() for cell in gardencare_4_submenus) or any(cell.strip() for cell in gardencare_10_submenus):

        # Build one full row with all columns A-U (21 columns)
        row = [
            log_id,  # A
            date,    # B
            worker,  # C
        ] + gardencare_4_submenus + gardencare_10_submenus

        gardencare_rows.append(row)

    if gardencare_rows:
        sheet_service.values().append(
            spreadsheetId=DAILY_LOGGER_ID,
            range="GardenCare!A2:V",
            valueInputOption="RAW",
            body={"values": gardencare_rows}
        ).execute()


    fruitflowercare_rows = []

    # Prepare placeholders for submenu answers with empty defaults
    a6_submenus = ['', '', '', '']   # submenu-6.2, 6.1, 6.3, 6.4
    a7_submenus = ['', '', '', '']  # submenu-7.2, 7.1, 7.3, 7.4
    a8_submenus = ['', '', '', '', '', '', '']  # submenu-8.2, 8.1, 8.3, 8.4, 8.5, 8.6, 8.7
    a9_submenus = ['', '', '', '', '', '', '']

    # Collect submenu data from activities
    for activity in activities:
        if activity.get('id') == '6':
            a6_submenus = [
                submenus.get('submenu-6.2', ''),
                submenus.get('submenu-6.1', ''),
                submenus.get('submenu-6.3', ''),
                submenus.get('submenu-6.4', '')
            ]
        elif activity.get('id') == '7':
            a7_submenus = [
                submenus.get('submenu-7.2', ''),
                submenus.get('submenu-7.1', ''),
                submenus.get('submenu-7.3', ''),
                submenus.get('submenu-7.4', '')
            ]
        elif activity.get('id') == '8':
            a8_submenus = [
                submenus.get('submenu-8.2', ''),
                submenus.get('submenu-8.1', ''),
                submenus.get('submenu-8.3', ''),
                submenus.get('submenu-8.4', ''),
                submenus.get('submenu-8.5', ''),
                submenus.get('submenu-8.6', ''),
                submenus.get('submenu-8.7', '')
            ]
        elif activity.get('id') == '9':
            a9_submenus = [
                submenus.get('submenu-9.2', ''),
                submenus.get('submenu-9.1', ''),
                submenus.get('submenu-9.3', ''),
                submenus.get('submenu-9.4', ''),
                submenus.get('submenu-9.5', ''),
                submenus.get('submenu-9.6', ''),
                submenus.get('submenu-9.7.1', ''),
                submenus.get('submenu-9.7.2', ''),
                submenus.get('submenu-9.8', '')
            ]

    # Only write if activity 6, 7, 8, or 9 was selected
    if any(act.get('id') in ['6', '7', '8', '9'] for act in activities):
        row = [
            log_id,     # A
            date,       # B
            worker      # C
        ] + a6_submenus + a7_submenus + a8_submenus + a9_submenus

        fruitflowercare_rows.append(row)

        sheet_service.values().append(
            spreadsheetId=DAILY_LOGGER_ID,
            range="'Fruit/FlowerCare'!A2:AA",
            valueInputOption="RAW",
            body={"values": fruitflowercare_rows}
        ).execute()


    return jsonify({
    "status": "success",
    "log_id": log_id,
    "savedDailyLog": 1,
    "savedTreeCare": len(treecare_rows),
    "savedGardenCare": len(gardencare_rows),
    "savedFruitFlowerCare": len(fruitflowercare_rows)
})

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
            'range': 'DailyLog!A1:H',
            'column_map': {
                'Log ID': 0,
                'Date': 1,
                'WorkerName': 2,
                'Phase': 3,
                'Zone': 4,
                'Line': 5,
                'TreeID': 6,
                'Activity': 7
            }
        },
        'TreeCare': {
            'range': 'TreeCare!A1:Y',
            'column_map': {
                'Log ID': 0,
                'Date': 1,
                'Worker Name': 2,
                'TreeID': 3,
                'Watering Duration': 4,
                'Notes': 5,
                'Tree Problem': 6,
                'Problem Details': 7,
                'Problem Severity': 8,
                'Sample Submitted': 9,
                'Corrective Action': 10,
                'Tree Trimming Code': 11,
                'Other Workers': 12,
                'Trimming Duration': 13,
                'Observations': 14
            }
        },
        'GardenCare': {
            'range': 'GardenCare!A1:V',  # adjust range as needed
            'column_map': {
                'Log ID': 0,
                'Date': 1,
                'Worker Name': 2,
                'Other Workers': 3,
                'Activity': 4,
                'Equipment': 5,
                'Duration': 6,
                'Notes': 7,
                'Chemical Name': 8,
                'Amount Used': 9,
                'Unit Type': 10,
                'Tank Size': 11,
                'Detail of Test Site': 12,
                'Value #1': 13,
                'Value #2': 14,
                'Value #3': 15,
                'Value #4': 16,
                'Value #5': 17,
                'Value #6': 18,
                'Value #7': 19,
                'Value #8': 20,
                'Notes': 21
            }
        },
        'Fruit/FlowerCare': {
            'range': 'Fruit/FlowerCare!A1:AA',  # Adjust column range if you have more columns
            'column_map': {
                'LogID': 0,
                'Date': 1,
                'Worker Name': 2,
                'Other Workers (Pollination)': 3,
                'Pollination Method': 4,
                'Duration (Pollination)': 5,
                'Notes (Pollination)': 6,
                'Other Workers (Product Conservation)': 7,
                'Product Conservation Method': 8,
                'Duration (Product Conservation)': 9,
                'Notes (Product Conservation)': 10,
                'Other Workers (Harvest)': 11,
                'Harvest Method': 12,
                'Duration (Harvest)': 13,
                'Total Weight Harvest (kgs)': 14,
                'Equipment Used': 15,
                'Notes (Harvest)': 16,
                'Other Workers (Post-Harvest)': 17,
                'Post-Harvest Method': 18,
                'Duration (Post-Harvest)': 19,
                'Equipment Used': 20,
                'Notes (Post-Harvest)': 21,
                'Chemical Name': 22,
                'Amount Used': 23,
                'Unit Type': 24,
                'Tank Size': 25
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

    try:
        format_result = sheet.get(
            spreadsheetId=DAILY_LOGGER_ID,
            ranges=[sheet_config['range'].split('!')[0] + '!1:1'],  # Get first row only
            includeGridData=True
        ).execute()

        bg_colors = []
        grid_data = format_result['sheets'][0]['data'][0]['rowData'][0]['values']
        for cell in grid_data:
            color = cell.get('effectiveFormat', {}).get('backgroundColor', {})
            r = int(color.get('red', 0) * 255)
            g = int(color.get('green', 0) * 255)
            b = int(color.get('blue', 0) * 255)
            bg_colors.append(f'rgb({r},{g},{b})')
    except Exception as e:
        print("Warning: Couldn't fetch header colors:", e)
        bg_colors = ['#333'] * len(headers)

    # If number of colors less than headers, fill rest
    if len(bg_colors) < len(headers):
        bg_colors += ['#333'] * (len(headers) - len(bg_colors))

    return render_template(
        'view_log.html',
        headers=headers,
        rows=rows,
        sort_by=sort_by,
        sheet_name=sheet_name,
        header_colors=bg_colors  
    )

@app.route('/api/save-formula', methods=['POST'])
def save_formula():
    data = request.get_json()

    # Basic validation
    formula_id = data.get('formulaId')
    one_time_use = data.get('oneTimeUse')
    chemicals = data.get('chemicals')
    water_volume = data.get('waterVolume')

    if not formula_id or one_time_use not in ['Y', 'N'] or not chemicals or not isinstance(chemicals, list):
        return jsonify({'error': 'Invalid data submitted'}), 400

    try:

        # Append rows to Formulations sheet
        rows_to_append = []
        for chem in chemicals:
            thai_name = chem.get('thaiName')
            amount = chem.get('amount')
            unit = chem.get('unit')
            if not thai_name or amount is None or not unit:
                return jsonify({'error': 'Missing chemical details'}), 400

            row = [
                formula_id, '', thai_name, amount, unit, '', '', water_volume if water_volume is not None else ''
            ]
            rows_to_append.append(row)

        # Append to Formulations
        sheet.values().append(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range='Formulations!A:H',
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body={'values': rows_to_append}
        ).execute()

        # Read existing metadata
        result = sheet.values().get(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range='FormuMetadata!A:E'
        ).execute()

        metadata_records = result.get('values', [])
        formula_ids = [row[0] for row in metadata_records[1:]] if len(metadata_records) > 1 else []

        if formula_id in formula_ids:
            index = formula_ids.index(formula_id)
            # Update One-Time-Use flag (col E)
            range_to_update = f'FormuMetadata!E{index + 2}'
            sheet.values().update(
                spreadsheetId=CHEMICALS_SHEET_ID,
                range=range_to_update,
                valueInputOption='USER_ENTERED',
                body={'values': [[one_time_use]]}
            ).execute()
        else:
            # Append new metadata row
            new_metadata_row = [formula_id, '', '', '', one_time_use]
            sheet.values().append(
                spreadsheetId=CHEMICALS_SHEET_ID,
                range='FormuMetadata!A:E',
                valueInputOption='USER_ENTERED',
                insertDataOption='INSERT_ROWS',
                body={'values': [new_metadata_row]}
            ).execute()

        return jsonify({'status': 'success', 'formulaId': formula_id})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/save-soil-test', methods=['POST'])
def save_soil_test():
    # Optionally require authentication like other APIs
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}

    test_site = data.get('testSiteDetail', '').strip()
    values = data.get('values')  # expected list length up to 8 (can be fewer)
    notes = data.get('notes', '').strip()

    # Basic validation
    if not test_site:
        return jsonify({'error': 'testSiteDetail is required'}), 400
    if not isinstance(values, list) or len(values) == 0:
        return jsonify({'error': 'values must be a list with at least one entry'}), 400

    # Ensure at least one non-empty numeric value
    has_value = any(v is not None and str(v).strip() != '' for v in values)
    if not has_value:
        return jsonify({'error': 'At least one Value field must be provided'}), 400

    # Normalize values to exactly 8 columns (pad with empty strings)
    normalized_values = []
    for i in range(8):
        if i < len(values):
            v = values[i]
            # allow numeric strings or numbers. If empty or null -> ''
            if v is None or (isinstance(v, str) and v.strip() == ''):
                normalized_values.append('')
            else:
                normalized_values.append(v)
        else:
            normalized_values.append('')

    # Build the row in the order L -> U (Detail, V1..V8, Notes)
    row = [test_site] + normalized_values + [notes]

    try:
        # Append to GardenCare sheet in your DAILY_LOGGER_ID spreadsheet
        sheet.values().append(
            spreadsheetId=DAILY_LOGGER_ID,
            range='GardenCare!L:U',  # columns L..U inclusive
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body={'values': [row]}
        ).execute()

        return jsonify({'status': 'success'}), 200

    except Exception as e:
        # keep the real error for logs, but return a friendly message
        app.logger.exception("Failed to save soil test")
        return jsonify({'error': 'Failed to save soil test', 'details': str(e)}), 500
    
@app.route("/api/inventory", methods=["GET"])
def get_inventory():
    result = sheet.values().get(
        spreadsheetId=CHEMICALS_SHEET_ID,
        range=INVENTORY_RANGE
    ).execute()

    values = result.get("values", [])
    if not values:
        return jsonify([])

    headers = values[0]
    rows = values[1:]
    inventory = []

    for row in rows:
        if len(row) < len(headers):
            row += [""] * (len(headers) - len(row))
        item = dict(zip(headers, row))
        try:
            stocked = float(item.get("Total Quantity Stocked", 0))
            used = float(item.get("Total Quantity Used", 0))
            item["Available"] = stocked - used
        except:
            item["Available"] = 0
        inventory.append(item)

    return jsonify(inventory)


# ===== 2. USE INVENTORY =====
@app.route("/api/inventory/use", methods=["POST"])
def use_inventory():
    data = request.json
    product_name = data.get("product")
    amount = float(data.get("quantity", 0))

    # Fetch current inventory
    result = sheet.values().get(
        spreadsheetId=CHEMICALS_SHEET_ID,
        range=INVENTORY_RANGE
    ).execute()

    values = result.get("values", [])
    if not values:
        return jsonify({"status": "error", "message": "No data found"}), 404
    
    headers = values[0]
    rows = values[1:]
    header_idx = {h: i for i, h in enumerate(headers)}

    used_idx = header_idx.get("Total Quantity Used")
    if used_idx is None:
        return jsonify({"status": "error", "message": "'Total Quantity Used' column not found"}), 400

    updated = False
    for i, row in enumerate(rows, start=2):
        if len(row) <= used_idx:
            row += ["0"] * (used_idx - len(row) + 1)
        if row[header_idx["Product Name"]] == product_name:
            current_used = float(row[used_idx] or 0)
            row[used_idx] = str(current_used + amount)
            # Update the sheet
            sheet.values().update(
                spreadsheetId=CHEMICALS_SHEET_ID,
                range=f"Inventory!A{i}:U{i}",
                valueInputOption="RAW",
                body={"values": [row]}
            ).execute()
            updated = True
            break

    if not updated:
        return jsonify({"status": "error", "message": f"Product {product_name} not found"}), 404    

    return jsonify({"status": "success"})


# ===== 3. RESET INVENTORY =====
@app.route("/api/inventory/reset", methods=["POST"])
def reset_all_usage():
    result = sheet.values().get(
        spreadsheetId=CHEMICALS_SHEET_ID,
        range=INVENTORY_RANGE
    ).execute()
    values = result.get("values", [])
    if not values:
        return jsonify({"status": "error", "message": "No data found"}), 404

    headers = values[0]
    rows = values[1:]
    used_idx = headers.index("Total Quantity Used") if "Total Quantity Used" in headers else None
    if used_idx is None:
        return jsonify({"status": "error", "message": "'Total Quantity Used' column not found"}), 400

    for i, row in enumerate(rows, start=2):
        if len(row) <= used_idx:
            row += ["0"] * (used_idx - len(row) + 1)
        row[used_idx] = "0"
        sheet.values().update(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range=f"Inventory!A{i}:U{i}",
            valueInputOption="RAW",
            body={"values": [row]}
        ).execute()

    return jsonify({"status": "success", "message": "All usage reset"})

@app.route("/api/inventory/reset/<product_name>", methods=["POST"])
def reset_product_usage(product_name):
    result = sheet.values().get(
        spreadsheetId=CHEMICALS_SHEET_ID,
        range=INVENTORY_RANGE
    ).execute()
    values = result.get("values", [])
    if not values:
        return jsonify({"status": "error", "message": "No data found"}), 404

    headers = values[0]
    rows = values[1:]
    header_idx = {h: i for i, h in enumerate(headers)}
    
    used_cols = ["Total Quantity Used", "Total Packages Used", "Monthly Quantity Used", "Monthly Packages Used"]
    found = False
    for i, row in enumerate(rows, start=2):
        if row[header_idx["Product Name"]] == product_name:
            for col in used_cols:
                if col not in header_idx:
                    continue
                idx = header_idx[col]
                if len(row) <= idx:
                    row += ["0"] * (idx - len(row) + 1)
                row[idx] = "0"
            sheet.values().update(
                spreadsheetId=CHEMICALS_SHEET_ID,
                range=f"Inventory!A{i}:U{i}",
                valueInputOption="RAW",
                body={"values": [row]}
            ).execute()
            found = True
            break

    if not found:
        return jsonify({"status": "error", "message": f"Product {product_name} not found"}), 404

    return jsonify({"status": "success", "message": f"Usage reset for {product_name}"})

# ===== 4. ADD NEW STOCK =====
@app.route("/api/inventory/add", methods=["POST"])
def add_stock():
    data = request.json
    product = data.get("product")
    amount = float(data.get("amount", 0))
    unit = data.get("unit", "")

    # Fetch inventory
    result = sheet.values().get(
        spreadsheetId=CHEMICALS_SHEET_ID,
        range=INVENTORY_RANGE
    ).execute()

    values = result.get("values", [])
    headers = values[0]
    rows = values[1:]

    found = False
    for i, row in enumerate(rows, start=2):
        if row[0] == product:
            stocked = float(row[1]) if len(row) > 1 else 0
            row[1] = str(stocked + amount)
            if unit:
                if len(row) < 5:
                    row += [""] * (5 - len(row))
                row[4] = unit
            sheet.values().update(
                spreadsheetId=CHEMICALS_SHEET_ID,
                range=f"Inventory!A{i}:U{i}",
                valueInputOption="RAW",
                body={"values": [row]}
            ).execute()
            found = True
            break

    # If product not found → append new row
    if not found:
        new_row = [product, str(amount), "0", str(amount), unit]
        sheet.values().append(
            spreadsheetId=CHEMICALS_SHEET_ID,
            range="Inventory!A:U",
            valueInputOption="RAW",
            body={"values": [new_row]}
        ).execute()

    return jsonify({"status": "stock added"})

if __name__ == '__main__':
    app.run(debug=True)
