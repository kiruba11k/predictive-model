import joblib
import os
import numpy as np

from sentence_transformers import SentenceTransformer
from sklearn.linear_model import SGDClassifier


MODEL_PATH = "predictor.pkl"


class Predictor:


    def __init__(self):

        self.encoder = SentenceTransformer(
            "all-MiniLM-L6-v2"
        )

        if os.path.exists(MODEL_PATH):

            loaded = joblib.load(MODEL_PATH)

            if isinstance(loaded, SGDClassifier):

                self.model = loaded

            else:

                print("Replacing incompatible model")

                self.model = SGDClassifier(
                    loss="log_loss"
                )

        else:

            self.model = SGDClassifier(
                loss="log_loss"
            )


    def predict(self, text):

        vec = self.encoder.encode([text])

        try:

            prob = self.model.predict_proba(vec)[0][1]

            pred = self.model.predict(vec)[0]

        except:

            prob = 0.5
            pred = 0

        return pred, prob


    def learn_batch(self, items):

        vectors = []
        labels = []

        for text, actual in items:

            label = 1 if actual == "Yes" else 0

            vec = self.encoder.encode(text)

            vectors.append(vec)

            labels.append(label)

        self.model.partial_fit(

            np.array(vectors),

            np.array(labels),

            classes=np.array([0, 1])

        )

        joblib.dump(self.model, MODEL_PATH)
