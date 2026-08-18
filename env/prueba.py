from groq import Groq

client = Groq(api_key="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")

models = client.models.list()

for model in models.data:
    print(model.id)