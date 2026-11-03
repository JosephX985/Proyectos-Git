(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const expressionEl = $("#expression");
  const resultEl = $("#result");
  const previewEl = $("#expressionPreview");
  const keypad = $("#keypad");
  const calculator = $("#calculator");
  const toast = $("#toast");

  const themes = {
    glass: [
      "Cristal Aero",
      "Transparencias, reflejos y profundidad luminosa."
    ],
    stone: [
      "Tallado en piedra",
      "Texturas minerales, relieves y tonos cálidos."
    ],
    aesthetic: [
      "Aesthetic",
      "Pasteles suaves, superficies delicadas y calma visual."
    ],
    modern: [
      "Moderno Premium",
      "Grafito, metal y precisión minimalista."
    ],
    cyber: [
      "Cyberpunk Neon",
      "Contrastes eléctricos y energía neón."
    ],
    aurora: [
      "Aurora Dream",
      "Colores cósmicos y una atmósfera envolvente."
    ]
  };

  let expression = "";
  let justEvaluated = false;
  let degrees = true;
  let history = [];
  let toastTimer;

  let motionEnabled = !window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // =====================================
  // NOTIFICACIONES
  // =====================================

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1900);
  }

  // =====================================
  // SISTEMA DE TEMAS
  // =====================================

  function setTheme(theme) {
    if (!Object.hasOwn(themes, theme)) return;

    document.body.dataset.theme = theme;

    $("#themeSelect").value = theme;

    $("#themeName").textContent = themes[theme][0];

    $("#themeDescription").textContent = themes[theme][1];

    document.querySelectorAll(".swatch").forEach((button) => {
      const active = button.dataset.themeChoice === theme;

      button.classList.toggle("active", active);

      button.setAttribute("aria-pressed", String(active));
    });

    try {
      localStorage.setItem("calc3d-theme", theme);
    } catch (_) {
      // El almacenamiento es opcional.
    }
  }

  // =====================================
  // PANTALLA
  // =====================================

  function render() {
    expressionEl.textContent = expression || "0";

    previewEl.textContent = "";

    if (!expression) {
      resultEl.textContent = "0";
    }

    $("#modeLabel").textContent =
      expression.includes("sin") ||
      expression.includes("cos") ||
      expression.includes("tan") ||
      expression.includes("sqrt") ||
      expression.includes("^")
        ? "CIENTÍFICA"
        : "ESTÁNDAR";
  }

  // =====================================
  // INTRODUCIR VALORES
  // =====================================

  function append(value) {
    if (justEvaluated && /^[0-9.]$/.test(value)) {
      expression = "";
    }

    justEvaluated = false;

    if (
      value === "." &&
      /(?:^|[+\-×÷^(])\d*\.?\d*$/.test(expression) &&
      expression.split(/[+\-×÷^()]/).pop().includes(".")
    ) {
      return;
    }

    expression += value;

    render();
  }

  // =====================================
  // LIMPIAR Y BORRAR
  // =====================================

  function clearAll() {
    expression = "";
    justEvaluated = false;
    render();
  }

  function deleteLast() {
    expression = expression.slice(0, -1);
    justEvaluated = false;
    render();
  }

  // =====================================
  // ANALIZADOR MATEMÁTICO SEGURO
  // No utiliza eval() ni Function()
  // =====================================

  function tokenize(input) {
    const normalized = input
      .replaceAll("×", "*")
      .replaceAll("÷", "/")
      .replaceAll("−", "-")
      .replace(/\s+/g, "");

    const tokens = [];

    const pattern =
      /\d+(?:\.\d*)?|\.\d+|(?:sin|cos|tan|sqrt|log|ln|abs)|pi|e|[()+\-*/%^]/gy;

    let position = 0;

    while (position < normalized.length) {
      pattern.lastIndex = position;

      const match = pattern.exec(normalized);

      if (!match) {
        throw new Error("Expresión no válida");
      }

      tokens.push(match[0]);

      position = pattern.lastIndex;
    }

    return tokens;
  }

  // =====================================
  // EVALUADOR MATEMÁTICO
  // =====================================

  function evaluate(input) {
    const tokens = tokenize(input);

    let index = 0;

    const peek = () => tokens[index];

    const take = () => tokens[index++];

    function primary() {
      const token = take();

      if (token === undefined) {
        throw new Error("Expresión incompleta");
      }

      if (token === "+") {
        return unary();
      }

      if (token === "-") {
        return -unary();
      }

      if (token === "(") {
        const value = addSub();

        if (take() !== ")") {
          throw new Error("Falta cerrar paréntesis");
        }

        return value;
      }

      if (
        ["sin", "cos", "tan", "sqrt", "log", "ln", "abs"]
          .includes(token)
      ) {
        let value;

        if (peek() === "(") {
          take();

          value = addSub();

          if (take() !== ")") {
            throw new Error("Falta cerrar paréntesis");
          }
        } else {
          value = unary();
        }

        const angle = degrees
          ? value * Math.PI / 180
          : value;

        const funcs = {
          sin: () => Math.sin(angle),
          cos: () => Math.cos(angle),
          tan: () => Math.tan(angle),

          sqrt: () => Math.sqrt(value),

          log: () => Math.log10(value),

          ln: () => Math.log(value),

          abs: () => Math.abs(value)
        };

        return funcs[token]();
      }

      if (token === "pi") {
        return Math.PI;
      }

      if (token === "e") {
        return Math.E;
      }

      if (/^(?:\d+\.?\d*|\.\d+)$/.test(token)) {
        return Number(token);
      }

      throw new Error("Valor no reconocido");
    }

    function unary() {
      return primary();
    }

    function power() {
      let value = primary();

      if (peek() === "^") {
        take();

        value = Math.pow(value, unary());
      }

      if (peek() === "%") {
        take();

        value /= 100;
      }

      return value;
    }

    function multiply() {
      let value = power();

      while (peek() === "*" || peek() === "/") {
        const op = take();

        const right = power();

        if (op === "/" && right === 0) {
          throw new Error("No se puede dividir entre cero");
        }

        value =
          op === "*"
            ? value * right
            : value / right;
      }

      return value;
    }

    function addSub() {
      let value = multiply();

      while (peek() === "+" || peek() === "-") {
        const op = take();

        const right = multiply();

        value =
          op === "+"
            ? value + right
            : value - right;
      }

      return value;
    }

    if (!tokens.length) {
      throw new Error("Escribe una operación");
    }

    const answer = addSub();

    if (index !== tokens.length) {
      throw new Error("Revisa la expresión");
    }

    if (!Number.isFinite(answer)) {
      throw new Error("Resultado fuera de rango");
    }

    return answer;
  }

  // =====================================
  // FORMATO DE RESULTADOS
  // =====================================

  function formatNumber(number) {
    if (Object.is(number, -0)) {
      number = 0;
    }

    return Number(number.toPrecision(12)).toLocaleString(
      "es-ES",
      {
        maximumFractionDigits: 10
      }
    );
  }

  // =====================================
  // REALIZAR CÁLCULO
  // =====================================

  function calculate() {
    if (!expression) return;

    try {
      const answer = evaluate(expression);

      const formatted = formatNumber(answer);

      resultEl.textContent = formatted;

      previewEl.textContent = "= " + formatted;

      history.unshift({
        expression,
        result: formatted
      });

      history = history.slice(0, 12);

      renderHistory();

      expression = String(answer);

      justEvaluated = true;

    } catch (error) {
      showToast(error.message || "No se pudo calcular");

      resultEl.textContent = "Error";
    }
  }

  // =====================================
  // HISTORIAL
  // =====================================

  function renderHistory() {
    const list = $("#historyList");

    list.replaceChildren();

    if (!history.length) {
      const empty = document.createElement("li");

      empty.className = "empty-history";

      empty.textContent =
        "Tus operaciones aparecerán aquí.";

      list.append(empty);

      return;
    }

    history.forEach((item) => {
      const li = document.createElement("li");

      li.className = "history-item";

      const button = document.createElement("button");

      button.type = "button";

      button.textContent = item.expression;

      button.addEventListener("click", () => {
        expression = item.expression;

        justEvaluated = false;

        render();

        $("#historyPanel").hidden = true;
      });

      const result = document.createElement("span");

      result.textContent = "= " + item.result;

      li.append(button, result);

      list.append(li);
    });
  }

  // =====================================
  // INTERACCIÓN CON LOS BOTONES
  // =====================================

  keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    button.classList.add("pressed");

    setTimeout(() => {
      button.classList.remove("pressed");
    }, 110);

    if (button.dataset.action === "clear") {
      clearAll();
    }

    else if (button.dataset.action === "delete") {
      deleteLast();
    }

    else if (button.dataset.action === "equals") {
      calculate();
    }

    else if (button.dataset.value) {
      append(button.dataset.value);
    }
  });

  // =====================================
  // CAMBIO DE TEMAS
  // =====================================

  $("#themeSelect").addEventListener("change", (event) => {
    setTheme(event.target.value);
  });

  document.querySelectorAll(".swatch").forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(button.dataset.themeChoice);
    });
  });

  // =====================================
  // ACTIVAR / DESACTIVAR EFECTOS 3D
  // =====================================

  $("#motionToggle").addEventListener("click", () => {
    motionEnabled = !motionEnabled;

    document.body.classList.toggle(
      "reduce-motion",
      !motionEnabled
    );

    $("#motionToggle").setAttribute(
      "aria-pressed",
      String(!motionEnabled)
    );

    showToast(
      motionEnabled
        ? "Efectos 3D activados"
        : "Efectos 3D reducidos"
    );
  });

  // =====================================
  // GRADOS Y RADIANES
  // =====================================

  $("#angleToggle").addEventListener("click", () => {
    degrees = !degrees;

    $("#angleToggle").textContent =
      degrees ? "DEG" : "RAD";

    $("#angleToggle").setAttribute(
      "aria-label",
      degrees
        ? "Unidad angular: grados"
        : "Unidad angular: radianes"
    );
  });

  // =====================================
  // MOSTRAR HISTORIAL
  // =====================================

  $("#historyToggle").addEventListener("click", () => {
    $("#historyPanel").hidden =
      !$("#historyPanel").hidden;
  });

  // =====================================
  // LIMPIAR HISTORIAL
  // =====================================

  $("#clearHistory").addEventListener("click", () => {
    history = [];

    renderHistory();
  });

  // =====================================
  // SOPORTE PARA TECLADO FÍSICO
  // =====================================

  document.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (/^[0-9.]$/.test(event.key)) {
      append(event.key);
    }

    else if (
      ["+", "-", "*", "/", "%", "^", "(", ")"]
        .includes(event.key)
    ) {
      append(
        ({
          "*": "×",
          "/": "÷",
          "-": "−"
        })[event.key] || event.key
      );
    }

    else if (
      event.key === "Enter" ||
      event.key === "="
    ) {
      event.preventDefault();

      calculate();
    }

    else if (event.key === "Backspace") {
      deleteLast();
    }

    else if (event.key === "Escape") {
      clearAll();
    }
  });

  // =====================================
  // EFECTO 3D CON EL MOUSE
  // =====================================

  calculator.addEventListener("pointermove", (event) => {
    if (
      !motionEnabled ||
      event.pointerType !== "mouse"
    ) {
      return;
    }

    const rect = calculator.getBoundingClientRect();

    const x =
      (event.clientX - rect.left) / rect.width;

    const y =
      (event.clientY - rect.top) / rect.height;

    calculator.style.transform =
      `rotateX(${(0.5 - y) * 5}deg) ` +
      `rotateY(${(x - 0.5) * 6}deg) ` +
      `translateZ(5px)`;
  });

  calculator.addEventListener("pointerleave", () => {
    calculator.style.transform = "";
  });

  // =====================================
  // RECUPERAR TEMA GUARDADO
  // =====================================

  try {
    const savedTheme =
      localStorage.getItem("calc3d-theme");

    if (
      savedTheme &&
      Object.hasOwn(themes, savedTheme)
    ) {
      setTheme(savedTheme);
    }

  } catch (_) {
    setTheme("glass");
  }

  // =====================================
  // INICIALIZACIÓN
  // =====================================

  document.body.classList.toggle(
    "reduce-motion",
    !motionEnabled
  );

  render();

  renderHistory();

})();