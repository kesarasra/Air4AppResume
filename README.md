
# Daily Logger Web App

A multi-step web app for logging daily activities of workers, backed by Google Sheets as a database.  
This app uses Flask (Python) for the backend API, Google Sheets API for data storage, and vanilla JavaScript for the frontend.

---

## 🚀 Features

- Multi-step form workflow:
  1. Select worker and date  
  2. Select work location details (phase, zone, line, or tree ID)  
  3. Select one or more activities performed  
  4. Review and confirm submission  
- Fetches worker names, tree IDs, line numbers, and activity types dynamically from Google Sheets  
- Client-side validation for input accuracy  
- Google Sheets used as a lightweight backend database  
- Session storage for smooth state management between form steps

---

## 🧰 Tech Stack

- **Backend:** Flask (Python), Google Sheets API v4  
- **Frontend:** HTML, CSS, JavaScript  
- **Database:** Google Sheets (cloud-based)

---

## 🔧 Setup Instructions

### Prerequisites

- Python 3.7+  
- A Google Cloud project with the Google Sheets API enabled  
- A service account with Editor access to the target Google Sheet  
- A Google Sheet structured to store:
  - Worker list
  - Activity list
  - Tree/Line data
  - Daily logs

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/kesarasra/Air4App.git
   cd Air4App
   ```

2. **Create and activate a virtual environment**

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Add your service account credentials**

   - Place your downloaded `credentials.json` file inside the project root.  
   - Ensure your Google Sheet is shared with the service account email.

5. **Run the app**

   ```bash
   flask run
   ```

6. **Open the app in your browser**

   - Visit: [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## 📁 Project Structure

```
Air4App/
├── app.py               # Flask application
├── credentials.json     # Google Sheets API service account
├── templates/
│   └── index.html       # Main frontend
├── static/
│   ├── script.js        # JS for dynamic form
│   └── style.css        # Basic styling
├── requirements.txt     # Python dependencies
└── README.md
```

---

## 📦 requirements.txt contents

The following Python packages are needed to run this project:

```
Flask==2.3.2
google-api-python-client==2.123.0
google-auth==2.29.0
google-auth-oauthlib==1.2.0
```

---

## 📄 License

This project is licensed under the MIT License.

You are free to use, modify, and distribute this software for personal or commercial purposes.  
See the [LICENSE](LICENSE) file for full license text.

---

## 🙌 Contributions

Contributions are welcome!

- Found a bug? [Open an issue](https://github.com/kesarasra/Air4App/issues)
- Want to add a feature or improve the code? Submit a pull request!

Visit the project on GitHub: [https://github.com/kesarasra/Air4App](https://github.com/kesarasra/Air4App)
