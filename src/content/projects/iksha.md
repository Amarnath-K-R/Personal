---
title: "Iksha App: Offline Conversational Clinical Registry"
short: "Iksha"
area: clinical
order: 3
role: "Builder"
venue: "Ophthalmology registry"
status: "Software"
numbers:
  - { value: "1", label: "hospital machine, with no internet" }
  - { value: "0", label: "database writes by the language model" }
  - { value: "0", label: "hard deletes" }
question: "Can clinicians talk to a registry without patient data ever leaving the hospital?"
built: "Clinicians type or dictate to a local language model (Qwen2.5 or Llama 3.2 through Ollama). Each hospital defines its own schema, and the system generates validation, views and the model's tool set at runtime. It includes AI fundus screening and a literature assistant that cites every statement. Built with Python, FastAPI, React and Tauri."
record:
  claim: "A conversational registry can run on one hospital machine with no internet, so patient data never leaves it."
  evidence: "The model's output is grammar constrained, and it can propose changes but can never write to the database. Every value on screen comes from PostgreSQL."
  limits: "Writes are versioned, nothing is hard deleted, and an append only, hash chained audit log records each change."
---
