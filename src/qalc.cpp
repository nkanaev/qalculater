#include <libqalculate/qalculate.h>
#include <emscripten/bind.h>
#include <sstream>

using namespace emscripten;

Calculator* getCalculator() {
    // there's only one global calculator, and you're not supposed to call
    // the Calculator constructor after it's initialized
    if (CALCULATOR == nullptr) {
        new Calculator();
    }
    return CALCULATOR;
}

static std::string jsonEscape(const std::string& s) {
    std::string out;
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += c;
                }
        }
    }
    return out;
}

EMSCRIPTEN_BINDINGS(calculator_bindings) {
    class_<Calculator>("Calculator")
        .constructor(&getCalculator, allow_raw_pointers())
        .function("reset", &Calculator::reset)
        .function("loadGlobalDefinitions", select_overload<bool()>(&Calculator::loadGlobalDefinitions))
        .function("getVersion", optional_override([](Calculator&) -> std::string {
            return std::to_string(QALCULATE_MAJOR_VERSION) + "." + std::to_string(QALCULATE_MINOR_VERSION) + "." + std::to_string(QALCULATE_MICRO_VERSION);
        }))
        .function("calculate", optional_override([](Calculator& self, std::string input) -> std::string {
            std::string expr_fmt, result, error;
            bool approx = false;
            try {
                self.clearMessages();
                MathStructure parsed = self.parse(input);
                PrintOptions po = default_print_options;
                po.is_approximate = &approx;
                expr_fmt = parsed.print(po);
                self.startControl(1000);
                MathStructure res = self.calculate(parsed, default_user_evaluation_options);
                self.stopControl();
                result = self.print(res, 1000, po);
                while (self.message()) {
                    CalculatorMessage* m = self.message();
                    std::string line = m->message();
                    if (m->type() == MESSAGE_ERROR) line = "error: " + line;
                    else if (m->type() == MESSAGE_WARNING) line = "warning: " + line;
                    if (!error.empty()) error += "\n";
                    error += line;
                    self.nextMessage();
                }
            } catch (...) {
                error = "exception during calculation";
            }
            std::ostringstream oss;
            oss << "{\"expr\":\"" << jsonEscape(input)
                << "\",\"expr_fmt\":\"" << jsonEscape(expr_fmt)
                << "\",\"result\":\"" << jsonEscape(result)
                << "\",\"approx\":" << (approx ? "true" : "false")
                << ",\"error\":" << (error.empty() ? "null" : "\"" + jsonEscape(error) + "\"")
                << "}";
            return oss.str();
        }))
        .function("saveState", optional_override([](Calculator& self) -> std::string {
            return self.saveTemporaryDefinitions();
        }))
        .function("loadState", optional_override([](Calculator& self, std::string xml) -> bool {
            return self.loadDefinitions(xml.c_str(), true, true) > 0;
        }))
        .function("clearState", optional_override([](Calculator& self) {
            self.resetVariables();
        }));
}
