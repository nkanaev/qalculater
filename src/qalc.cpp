#include <libqalculate/qalculate.h>
#include <emscripten/bind.h>
#include <sstream>
#include <vector>

using namespace emscripten;

struct FunctionInfo {
    std::string name;
    std::string title;
    std::string category;
};

struct VariableInfo {
    std::string name;
    std::string title;
    std::string category;
};

struct UnitInfo {
    std::string name;
    std::string title;
    std::string category;
};

struct CurrencyRate {
    std::string code;
    double rate;
};

static std::string printableCategory(const std::string& cat) {
    bool printable = !cat.empty();
    for (unsigned char c : cat) {
        if (c < 0x20) { printable = false; break; }
    }
    return printable ? cat : "Other";
}

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

static void applyExchangeRate(Calculator& self, const std::string& code, double rate) {
    if (rate <= 0 || code.length() != 3 || code == "EUR") return;
    Unit* u = self.getUnit(code);
    if (!u || !u->isCurrency() || u->subtype() != SUBTYPE_ALIAS_UNIT) return;
    Unit* eur = self.getUnit("EUR");
    if (!eur) return;
    std::ostringstream oss;
    oss << "1/" << rate;
    ((AliasUnit*) u)->setBaseUnit(eur);
    ((AliasUnit*) u)->setExpression(oss.str());
    u->setApproximate();
    u->setPrecision(-2);
    u->setChanged(false);
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
            std::string expr_fmt, result;
            std::string warnings = "[", errors = "[";
            bool has_warning = false, has_error = false;
            bool approx = false;
            try {
                self.clearMessages();
                PrintOptions po = default_print_options;
                po.is_approximate = &approx;
                result = self.calculateAndPrint(input, 1000, default_user_evaluation_options, po, &expr_fmt);
                while (self.message()) {
                    CalculatorMessage* m = self.message();
                    std::string line = m->message();
                    if (m->type() == MESSAGE_ERROR) {
                        if (has_error) errors += ",";
                        errors += "\"" + jsonEscape(line) + "\"";
                        has_error = true;
                    } else if (m->type() == MESSAGE_WARNING) {
                        if (has_warning) warnings += ",";
                        warnings += "\"" + jsonEscape(line) + "\"";
                        has_warning = true;
                    }
                    self.nextMessage();
                }
            } catch (...) {
                if (has_error) errors += ",";
                errors += "\"exception during calculation\"";
                has_error = true;
            }
            warnings += "]";
            errors += "]";
            std::ostringstream oss;
            oss << "{\"expr\":\"" << jsonEscape(input)
                << "\",\"expr_fmt\":\"" << jsonEscape(expr_fmt)
                << "\",\"result\":\"" << jsonEscape(result)
                << "\",\"approx\":" << (approx ? "true" : "false")
                << ",\"warnings\":" << warnings
                << ",\"errors\":" << errors
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
        }))
        .function("getFunctions", optional_override([](Calculator& self) -> std::vector<FunctionInfo> {
            std::vector<FunctionInfo> out;
            for (size_t i = 0;; i++) {
                MathFunction* f = self.getFunction(i);
                if (!f) break;
                if (!f->isActive() || f->isHidden()) continue;
                FunctionInfo info;
                info.name = f->referenceName();
                info.title = f->title(false);
                info.category = printableCategory(f->category());
                out.push_back(info);
            }
            return out;
        }))
        .function("getVariables", optional_override([](Calculator& self) -> std::vector<VariableInfo> {
            std::vector<VariableInfo> out;
            for (size_t i = 0;; i++) {
                Variable* v = self.getVariable(i);
                if (!v) break;
                if (!v->isActive() || v->isHidden()) continue;
                VariableInfo info;
                info.name = v->referenceName();
                info.title = v->title(false);
                info.category = printableCategory(v->category());
                out.push_back(info);
            }
            return out;
        }))
        .function("getUnits", optional_override([](Calculator& self) -> std::vector<UnitInfo> {
            std::vector<UnitInfo> out;
            for (size_t i = 0;; i++) {
                Unit* u = self.getUnit(i);
                if (!u) break;
                if (!u->isActive() || u->isHidden()) continue;
                UnitInfo info;
                info.name = u->referenceName();
                info.title = u->title(false);
                info.category = printableCategory(u->category());
                out.push_back(info);
            }
            return out;
        }))
        .function("setExchangeRates", optional_override([](Calculator& self, std::vector<CurrencyRate> rates) -> int {
            int applied = 0;
            for (const CurrencyRate& r : rates) {
                applyExchangeRate(self, r.code, r.rate);
                applied++;
            }
            return applied;
        }));
}

EMSCRIPTEN_BINDINGS(definition_info_bindings) {
    value_object<FunctionInfo>("FunctionInfo")
        .field("name", &FunctionInfo::name)
        .field("title", &FunctionInfo::title)
        .field("category", &FunctionInfo::category);
    value_object<VariableInfo>("VariableInfo")
        .field("name", &VariableInfo::name)
        .field("title", &VariableInfo::title)
        .field("category", &VariableInfo::category);
    value_object<UnitInfo>("UnitInfo")
        .field("name", &UnitInfo::name)
        .field("title", &UnitInfo::title)
        .field("category", &UnitInfo::category);
    register_vector<FunctionInfo>("VectorFunctionInfo");
    register_vector<VariableInfo>("VectorVariableInfo");
    register_vector<UnitInfo>("VectorUnitInfo");
    value_object<CurrencyRate>("CurrencyRate")
        .field("code", &CurrencyRate::code)
        .field("rate", &CurrencyRate::rate);
    register_vector<CurrencyRate>("VectorCurrencyRate");
}
