const baseVideos = [
  { num: 1, title: "Arduino-ға кіріспе", desc: "Arduino IDE орнату, алғашқы жоба", dur: "10:24", url: "", tasks: [{ title: "IDE орнату", instruction: "IDE орнату қадамдарын жаз", maxScore: 10 }] },
  { num: 2, title: "LED жанату", desc: "Breadboard, резистор, LED схемасы", dur: "8:15", url: "", tasks: [{ title: "Схема", instruction: "LED схемасын суреттеп бер", maxScore: 10 }] },
  { num: 3, title: "Датчиктермен жұмыс", desc: "Температура, жарық датчиктері", dur: "12:40", url: "", tasks: [{ title: "DHT11", instruction: "DHT11 оқу кодын жазыңыз", maxScore: 10 }] },
  { num: 4, title: "IoT — Интернетке жалғау", desc: "WiFi модуль, Telegram бот", dur: "15:00", url: "", tasks: [{ title: "IoT жоба", instruction: "Жоба архитектурасын түсіндіріңіз", maxScore: 10 }] },
];

const baseConfig = {
  sensors: [
    { name: "DHT11 — Температура және ылғалдылық", desc: "DHT11 цифрлық датчик.", ico: "🌡️", lbl: "DHT11", note: "DATA мен VCC арасына 10кОм резистор.", pins: [["VCC", "5V", "p5", "Қорек"], ["GND", "GND", "pg", "Жер"], ["DATA", "D2", "pd", "Дерек"]] },
    { name: "HC-SR04 — Ультрадыбыс датчигі", desc: "Қашықтықты өлшейді.", ico: "📡", lbl: "HC-SR04", note: "ECHO пін 5В сигналына сезімтал.", pins: [["VCC", "5V", "p5", "Қорек"], ["GND", "GND", "pg", "Жер"], ["TRIG", "D9", "pd", "Trig"], ["ECHO", "D10", "pd", "Echo"]] },
  ],
  codes: [
    { title: "💡 LED жыпылықтату (Blink)", meta: "Бастаушыларға", code: "void setup(){ pinMode(13, OUTPUT);} void loop(){ digitalWrite(13, HIGH); delay(1000); digitalWrite(13, LOW); delay(1000);}"},
  ],
  quickQuestions: [
    { label: "Arduino дегеніміз не?", prompt: "Arduino дегеніміз не және қайда қолданылады?", type: "quick" },
    { label: "Uno мен Nano айырмасы", prompt: "Arduino Uno мен Nano арасындағы айырмашылықтарды түсіндір", type: "quick" },
    { label: "Breadboard қалай жұмыс істейді?", prompt: "Breadboard қолдану ережелерін түсіндір", type: "quick" },
    { label: "LED + резистор таңдауы", prompt: "LED үшін резисторды қалай таңдаймын? Формуламен түсіндір", type: "quick" },
    { label: "DHT11 оқу логикасы", prompt: "DHT11 датчигінен мәлімет оқу қадамдарын түсіндір", type: "quick" },
    { label: "HC-SR04 формуласы", prompt: "HC-SR04 арқылы қашықтық есептеу формуласын түсіндір", type: "quick" },
    { label: "analogRead vs digitalRead", prompt: "analogRead және digitalRead айырмашылығы қандай?", type: "quick" },
    { label: "IoT жобаны неден бастау?", prompt: "Arduino IoT жобасын бастау үшін қадамдық жоспар бер", type: "quick" },
    { label: "was not declared", prompt: "was not declared in this scope қатесін қалай түзетемін?", type: "error" },
    { label: "expected ; before", prompt: "expected ';' before қатесінің негізгі себептері қандай?", type: "error" },
    { label: "No such file or directory", prompt: "No such file or directory қатесін Arduino IDE-де қалай шешемін?", type: "error" },
    { label: "avrdude sync error", prompt: "avrdude: stk500_recv() programmer is not responding қатесін шешу жолдары", type: "error" },
    { label: "COM порт көрінбейді", prompt: "Arduino COM порт неге көрінбейді және қалай түзетуге болады?", type: "error" },
    { label: "Upload failed", prompt: "Sketch upload failed қатесін жүйелі түрде диагностикалау қадамдары", type: "error" },
  ],
};

function getSeedData(profile = "dev") {
  if (profile === "prod") {
    return {
      videos: baseVideos,
      config: baseConfig,
      teacherName: "Мұғалім",
      teacherEmail: "teacher@demo.kz",
    };
  }
  if (profile === "stage") {
    return {
      videos: baseVideos.slice(0, 3),
      config: baseConfig,
      teacherName: "Мұғалім (Stage)",
      teacherEmail: "teacher@stage.kz",
    };
  }
  return {
    videos: baseVideos,
    config: baseConfig,
    teacherName: "Мұғалім (Demo)",
    teacherEmail: "teacher@demo.kz",
  };
}

module.exports = { getSeedData };
