from flask import Flask, request, jsonify
import torch
import torch.nn as nn
import joblib
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/predict": {"origins": "*"}})  

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS':  
        response = jsonify({"message": "CORS preflight response"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        return response, 200

    data = request.json  
    return jsonify({"message": "Prediction successful!", "input": data})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)  



app = Flask(__name__)


class DQNModel(nn.Module):
    def __init__(self, input_size, hidden1, hidden2, output_size):
        super(DQNModel, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden1)  
        self.fc2 = nn.Linear(hidden1, hidden2)  
        self.fc3 = nn.Linear(hidden2, output_size)  

    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        x = self.fc3(x)  
        return x

input_size = 5  # Features: location, start_hour, end_hour, users_demand, day_of_week
hidden1 = 128  
hidden2 = 64  
output_size = 1  

dqn = DQNModel(input_size, hidden1, hidden2, output_size)


dqn.load_state_dict(torch.load(r"C:\Users\sowmi\Downloads\dqn_model.pth"))
dqn.eval()  


scaler = joblib.load(r"C:\Users\sowmi\Downloads\scaler.pkl")
label_encoders = joblib.load(r"C:\Users\sowmi\Downloads\label_encoders.pkl")
max_price = np.load(r"C:\Users\sowmi\Downloads\max_price.npy")

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    
    input_data = np.array([
        int(data["location"]),
        float(data["start_hour"]),
        float(data["end_hour"]),
        float(data["users_demand"]),
        int(data["day_of_week"])
    ]).reshape(1, -1)

    
    input_data = scaler.transform(input_data)

    
    input_tensor = torch.tensor(input_data, dtype=torch.float32)

    
    with torch.no_grad():
        predicted_price = dqn(input_tensor).item()

    
    predicted_price = predicted_price * max_price

    return jsonify({"predicted_price": round(predicted_price, 2)})

if __name__ == "__main__":
    app.run(debug=True)
