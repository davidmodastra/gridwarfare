from groq import Groq
import json
import os

client = Groq()

ARCHIVO_MEMORIA = "memoria.json"

# Cargar memoria existente
if os.path.exists(ARCHIVO_MEMORIA):
    with open(ARCHIVO_MEMORIA, "r", encoding="utf-8") as f:
        messages = json.load(f)
else:
    messages = [
        {
            "role": "system",
            "content": """Eres una IA asistente para ayudarme con mi proyecto GridWarfare.
Recuerda la información importante que el usuario te proporcione durante la conversación
y úsala para mantener el contexto."""
        }
    ]

print("🤖 GridWarfare AI")
print("Escribe 'salir' para cerrar.")
print("Escribe 'borrar memoria' para empezar de cero.\n")

while True:
    mensaje = input("Tú: ")

    if mensaje.lower() == "salir":
        break

    # Borrar memoria
    if mensaje.lower() == "borrar memoria":
        messages = [
            {
                "role": "system",
                "content": """Eres una IA asistente para ayudarme con mi proyecto GridWarfare.
Recuerda la información importante que el usuario te proporcione durante la conversación
y úsala para mantener el contexto."""
            }
        ]

        with open(ARCHIVO_MEMORIA, "w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)

        print("\n🧠 Memoria borrada.\n")
        continue

    # Guardar mensaje del usuario
    messages.append({
        "role": "user",
        "content": mensaje
    })

    respuesta = client.chat.completions.create(
        messages=messages,
        model="openai/gpt-oss-120b",
    )

    texto = respuesta.choices[0].message.content

    # Guardar respuesta
    messages.append({
        "role": "assistant",
        "content": texto
    })

    # Guardar memoria en disco
    with open(ARCHIVO_MEMORIA, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False, indent=2)

    print(f"\nIA: {texto}\n")