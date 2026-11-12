---
title: "VivOME Atlas: Single Cell RNA and Protein Atlas"
short: "VivOME Atlas"
area: omics
order: 2
role: "Builder"
venue: "Stanford, Department of Genetics"
status: "Deployed"
year: 2025
with: "Mentor Dr Michael P Snyder, Stanford W. Ascherman Professor of Genetics"
numbers:
  - { value: "5", label: "model PyTorch ensemble, trained on RNA only" }
  - { value: "7", label: "methods benchmarked under one shared protocol" }
  - { value: "~970", label: "automated tests" }
question: "Can a model trained only on RNA label cell types in protein data it has never seen?"
built: "A versioned atlas and web service that labels cell types in single cell mass spectrometry proteomics data, using a human blood RNA reference (Tabula Sapiens). It reads DIA-NN, Spectronaut, MaxQuant and FragPipe outputs, and runs on Google Cloud Run behind an invite only site."
record:
  claim: "A five model ensemble trained on RNA only can be applied to protein zero shot, giving each cell a conformal answer set."
  evidence: "Benchmarked against seven methods, including Harmony, scANVI, Seurat and MaxFuse, under one shared protocol."
  limits: "The service declines to answer, with a stated reason, when unsure. Every model change was preregistered, and every held out test was scored once."
---
