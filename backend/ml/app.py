"""
Insurance premium ML service (Flask).
Called internally by the Node Express API — not exposed directly to the browser.
"""
import os
from pathlib import Path

from flask import Flask, jsonify, request
import joblib

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

app = Flask(__name__)

model = None
column_transformer = None
load_error = None


def load_models():
    global model, column_transformer, load_error
    try:
        model_path = MODELS_DIR / "insurance_model.pkl"
        ct_path = MODELS_DIR / "column_transformer.pkl"
        if not model_path.is_file() or not ct_path.is_file():
            load_error = (
                f"Missing model files in {MODELS_DIR}. "
                "Copy insurance_model.pkl and column_transformer.pkl into backend/ml/models/"
            )
            return False
        model = joblib.load(model_path)
        column_transformer = joblib.load(ct_path)
        load_error = None
        return True
    except Exception as err:
        load_error = str(err)
        model = None
        column_transformer = None
        return False


load_models()


@app.route("/health", methods=["GET", "HEAD"])
def health():
    ready = model is not None and column_transformer is not None
    payload = {"ok": ready, "service": "premium-ml"}
    if load_error:
        payload["error"] = load_error
    return jsonify(payload), 200 if ready else 503


@app.route("/predict", methods=["POST"])
def predict():
    if model is None or column_transformer is None:
        if not load_models():
            return jsonify({"success": False, "error": load_error or "Models not loaded"}), 503

    try:
        data = request.get_json(silent=True) or {}

        raw_features = [[
            int(data["age"]),
            str(data["sex"]).lower(),
            float(data["bmi"]),
            int(data["children"]),
            str(data["smoker"]).lower(),
            str(data["region"]).lower(),
        ]]

        transformed = column_transformer.transform(raw_features)
        prediction = model.predict(transformed)

        return jsonify({
            "success": True,
            "premium": round(float(prediction[0]), 2),
        })
    except KeyError as err:
        return jsonify({"success": False, "error": f"Missing field: {err.args[0]}"}), 400
    except (TypeError, ValueError) as err:
        return jsonify({"success": False, "error": f"Invalid input: {err}"}), 400
    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 400


if __name__ == "__main__":
    # PORT is set by Render for a standalone Python Web Service; ML_PORT for local sidecar.
    port = int(os.environ.get("PORT") or os.environ.get("ML_PORT", 5001))
    host = os.environ.get("ML_HOST", "127.0.0.1")
    print(f"[ml] Premium predictor listening on http://{host}:{port}")
    if load_error:
        print(f"[ml] Warning: {load_error}")
    app.run(host=host, port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
