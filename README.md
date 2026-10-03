# 📚 Web eBook Reader

> A lightweight, responsive, multi-format web eBook reader built with vanilla JavaScript and modular adapter architecture.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Format](https://img.shields.io/badge/Formats-EPUB%20%7C%20MOBI%20%7C%20AZW-green.svg)](#supported-formats)

---

## 🌟 Features

- **Multi-Format Architecture:** Modular adapter design separating engine rendering from UI controls.
- **EPUB Support:** Powered by `epub.js` for fluid pagination, location tracking, and Table of Contents (TOC) parsing.
- **Kindle Binary Detection:** Built-in handler and fallback UI for `.mobi` and `.azw` files.
- **Typography & Theme Controls:** Customizable font size, line height, reader width, and themes (Light, Dark, Sepia).
- **Mobile First:** Touch/swipe edge navigation, responsive sidebar drawer, and adaptive padding.
- **Persistence:** LocalStorage saves theme preferences and reader formatting automatically.
- **Zero Server Overhead:** Runs entirely client-side out of the box.

---

## 🏗️ Architecture Overview

The app uses an **Adapter Pattern** (`ReaderEngine`) to decouple the user interface from format parsing.

```text
                  ┌────────────────────────┐
                  │    fileInput / Drop    │
                  └───────────┬────────────┘
                              │
                    ┌─────────▼────────┐
                    │   openBook()     │
                    └─────────┬────────┘
                              │
              ┌───────────────┴───────────────┐
              │ Ext: .epub                    │ Ext: .mobi, .azw
      ┌───────▼────────┐              ┌───────▼────────┐
      │   EpubEngine   │              │  BinaryEngine  │
      │  (epub.js)     │              │ (Fallback UI / │
      └───────┬────────┘              │  WASM Hook)    │
              │                       └───────┬────────┘
              └───────────────┬───────────────┘
                              │
                    ┌─────────▼────────┐
                    │    DOM Viewer    │
                    └──────────────────┘
