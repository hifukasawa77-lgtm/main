/*!
 * ことのは / Kotonoha v1.0.0 — 言語コア（レキサ・パーサ・インタプリタ）
 * 日本語プログラミング学習環境の言語エンジン。DOM非依存・純粋JS（ES2020）。
 * 公開API: Kotonoha.{VERSION, tokenize, parse, run, createStepper, KotonohaError}
 * 仕様: specs/kotonoha_spec.md §2〜§3
 */
(function () {
  "use strict";

  var DEFAULT_MAX_STEPS = 100000;
  var MAX_CALL_DEPTH = 500; // 再帰暴走でJSスタックが溢れる前に日本語エラーで止める

  // =====================================================================
  // KotonohaError
  // =====================================================================
  class KotonohaError extends Error {
    constructor(kind, line, col, message, hint) {
      super(message);
      this.name = "KotonohaError";
      this.kind = kind; // "lex" | "parse" | "runtime" | "step-limit"
      this.line = line == null ? null : line;
      this.col = col == null ? null : col;
      this.hint = hint || "";
    }
  }

  // 「{line}行目: {原因}。{直し方}」書式でエラーを生成する
  function err(kind, line, col, cause, hint) {
    var prefix = line == null ? "" : line + "行目: ";
    return new KotonohaError(kind, line, col, prefix + cause + "。" + (hint || ""), hint || "");
  }

  // =====================================================================
  // 正規化（全角→半角）: 文字列リテラル内部には適用しない（レキサが制御）
  // =====================================================================
  var ZEN_MAP = {
    "×": "*",   // ×
    "÷": "/",   // ÷
    "≠": "!=",  // ≠
    "≦": "<=",  // ≦
    "≧": ">=",  // ≧
    "　": " ",   // 全角スペース
    "、": ","    // 、
  };

  function normChar(ch) {
    if (ch === undefined || ch === "") return "";
    if (Object.prototype.hasOwnProperty.call(ZEN_MAP, ch)) return ZEN_MAP[ch];
    var code = ch.charCodeAt(0);
    // 全角英数字・全角記号（！〜～）→ 半角
    if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0);
    return ch;
  }

  function isDigitCh(c) {
    return c >= "0" && c <= "9";
  }

  function isIdentStartCh(c) {
    if (!c) return false;
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") return true;
    var code = c.charCodeAt(0);
    if (code >= 0x3040 && code <= 0x30ff) return true; // ひらがな・カタカナ（ー含む）
    if (code >= 0x4e00 && code <= 0x9fff) return true; // CJK漢字
    if (code === 0x3005) return true; // 々
    return false;
  }

  function isIdentPartCh(c) {
    return isIdentStartCh(c) || isDigitCh(c);
  }

  // キーワード（最長一致のため長い順）
  var KEYWORDS = [
    "そうでなければ",
    "の間繰り返す",
    "回繰り返す",
    "または", "ならば", "おわり", "抜ける", "続ける", "でない",
    "関数", "戻す", "表示", "もし", "かつ",
    "真", "偽"
  ];

  function matchKeyword(src, i) {
    for (var k = 0; k < KEYWORDS.length; k++) {
      if (src.startsWith(KEYWORDS[k], i)) return KEYWORDS[k];
    }
    return null;
  }

  // =====================================================================
  // レキサ
  // =====================================================================
  function tokenize(source, opts) {
    var tolerant = !!(opts && opts.tolerant);
    var src = String(source == null ? "" : source);
    var tokens = [];
    var i = 0, line = 1, col = 1;
    var n = src.length;

    function push(type, value, raw, l, c) {
      tokens.push({ type: type, value: value, line: l, col: c, raw: raw });
    }

    function lexFail(l, c, cause, hint, raw) {
      if (tolerant) {
        push("ERROR", raw, raw, l, c);
        return true; // 続行
      }
      throw err("lex", l, c, cause, hint);
    }

    while (i < n) {
      var startLine = line, startCol = col;
      var ch = src[i];

      // 改行・文末記号
      if (ch === "\n") { push("NEWLINE", "\n", "\n", line, col); i++; line++; col = 1; continue; }
      if (ch === "\r") { i++; col++; continue; }
      if (ch === "。") { push("NEWLINE", "。", ch, line, col); i++; col++; continue; } // 。

      var nc = normChar(ch);

      // 空白
      if (nc === " " || nc === "\t") { i++; col++; continue; }

      // コメント（# / ＃）行末まで
      if (nc === "#") {
        var cj = i;
        while (cj < n && src[cj] !== "\n") cj++;
        if (tolerant) push("COMMENT", src.slice(i, cj), src.slice(i, cj), line, col);
        col += cj - i;
        i = cj;
        continue;
      }

      // 文字列「…」（内部は正規化しない・原文保持）
      if (ch === "「") { // 「
        var sj = i + 1, sval = "";
        while (sj < n && src[sj] !== "」" && src[sj] !== "\n") { sval += src[sj]; sj++; }
        if (sj >= n || src[sj] === "\n") {
          var badRaw = src.slice(i, sj);
          col += sj - i;
          i = sj;
          if (lexFail(startLine, startCol,
            "文字列が閉じられていません",
            "「 で始めた文字列は同じ行の 」 で閉じてください。", badRaw)) continue;
        }
        push("STRING", sval, src.slice(i, sj + 1), startLine, startCol);
        col += sj + 1 - i;
        i = sj + 1;
        continue;
      }

      // 文字列 "…"（終端は " または ＂）
      if (nc === "\"") {
        var qj = i + 1, qval = "";
        while (qj < n && normChar(src[qj]) !== "\"" && src[qj] !== "\n") { qval += src[qj]; qj++; }
        if (qj >= n || src[qj] === "\n") {
          var badRaw2 = src.slice(i, qj);
          col += qj - i;
          i = qj;
          if (lexFail(startLine, startCol,
            "文字列が閉じられていません",
            "\" で始めた文字列は同じ行の \" で閉じてください。", badRaw2)) continue;
        }
        push("STRING", qval, src.slice(i, qj + 1), startLine, startCol);
        col += qj + 1 - i;
        i = qj + 1;
        continue;
      }

      // 数値（全角数字対応・小数対応）
      if (isDigitCh(nc)) {
        var dj = i, numStr = "";
        while (dj < n && isDigitCh(normChar(src[dj]))) { numStr += normChar(src[dj]); dj++; }
        if (dj < n && normChar(src[dj]) === "." && dj + 1 < n && isDigitCh(normChar(src[dj + 1]))) {
          numStr += ".";
          dj++;
          while (dj < n && isDigitCh(normChar(src[dj]))) { numStr += normChar(src[dj]); dj++; }
        }
        push("NUMBER", parseFloat(numStr), src.slice(i, dj), startLine, startCol);
        col += dj - i;
        i = dj;
        continue;
      }

      // キーワード（最長一致）
      var kw = matchKeyword(src, i);
      if (kw) {
        push("KEYWORD", kw, kw, startLine, startCol);
        i += kw.length;
        col += kw.length;
        continue;
      }

      // 識別子（走査中もキーワード最長一致で打ち切る）
      if (isIdentStartCh(nc)) {
        var ij = i, ident = "";
        while (ij < n) {
          if (ij > i && matchKeyword(src, ij)) break;
          var icNorm = normChar(src[ij]);
          if (ij === i ? !isIdentStartCh(icNorm) : !isIdentPartCh(icNorm)) break;
          ident += icNorm;
          ij++;
        }
        push("IDENT", ident, src.slice(i, ij), startLine, startCol);
        col += ij - i;
        i = ij;
        continue;
      }

      // ≠ ≦ ≧（正規化で2文字になるもの）
      if (nc.length === 2) {
        push("OP", nc, ch, startLine, startCol);
        i++; col++;
        continue;
      }

      // 2文字演算子 == != <= >=
      var nextNc = i + 1 < n ? normChar(src[i + 1]) : "";
      var two = nc + (nextNc.length === 1 ? nextNc : "");
      if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
        push("OP", two, src.slice(i, i + 2), startLine, startCol);
        i += 2; col += 2;
        continue;
      }

      // 1文字演算子
      if ("+-*/%=<>()[]{},:".indexOf(nc) >= 0) {
        push("OP", nc, ch, startLine, startCol);
        i++; col++;
        continue;
      }

      if (nc === "!") {
        i++; col++;
        if (lexFail(startLine, startCol,
          "「!」だけでは使えません",
          "等しくないことは「!=」または「≠」で書いてください。", ch)) continue;
      }

      // 不正文字
      i++; col++;
      lexFail(startLine, startCol,
        "使えない文字「" + ch + "」があります",
        "この文字を削除するか、正しい記号に書き換えてください。", ch);
    }

    push("EOF", "", "", line, col);
    return tokens;
  }

  // =====================================================================
  // パーサ（再帰下降）
  // =====================================================================
  var COMPARE_OPS = { "==": 1, "!=": 1, "<": 1, "<=": 1, ">": 1, ">=": 1 };

  class Parser {
    constructor(tokens) {
      this.toks = tokens;
      this.pos = 0;
      this.fnDepth = 0;
      this.loopDepth = 0;
    }
    peek(o) {
      var idx = this.pos + (o || 0);
      return this.toks[idx >= this.toks.length ? this.toks.length - 1 : idx];
    }
    next() {
      var t = this.peek();
      if (t.type !== "EOF") this.pos++;
      return t;
    }
    atKw(v) { var t = this.peek(); return t.type === "KEYWORD" && t.value === v; }
    atOp(v) { var t = this.peek(); return t.type === "OP" && t.value === v; }
    eatNewlines() { while (this.peek().type === "NEWLINE") this.pos++; }

    tokenLabel(t) {
      if (t.type === "NEWLINE") return "改行";
      if (t.type === "EOF") return "入力の終わり";
      return "「" + (t.raw || String(t.value)) + "」";
    }

    expectTerminator() {
      var t = this.peek();
      if (t.type === "NEWLINE") { this.next(); return; }
      if (t.type === "EOF") return;
      throw err("parse", t.line, t.col,
        "文の終わりに余分な" + this.tokenLabel(t) + "があります",
        "1つの文は1行に書き、続きは改行するか「。」で区切ってください。");
    }

    expectOp(v, cause, hint) {
      if (this.atOp(v)) return this.next();
      var t = this.peek();
      throw err("parse", t.line, t.col, cause, hint);
    }

    parseProgram() {
      var body = [];
      this.eatNewlines();
      while (this.peek().type !== "EOF") {
        body.push(this.parseStatement());
        this.eatNewlines();
      }
      return { type: "Program", body: body, line: 1, col: 1 };
    }

    // ブロック本体: stopKws のキーワード直前まで文を読む（stopKwは消費しない）
    parseStatements(stopKws, openTok) {
      var body = [];
      this.eatNewlines();
      for (;;) {
        var t = this.peek();
        if (t.type === "EOF") {
          throw err("parse", openTok.line, openTok.col,
            "「おわり」が足りません",
            "「もし」「繰り返す」「関数」のブロックは「おわり」で閉じます。");
        }
        if (t.type === "KEYWORD" && stopKws.indexOf(t.value) >= 0) return body;
        body.push(this.parseStatement());
        this.eatNewlines();
      }
    }

    parseStatement() {
      var t = this.peek();
      if (t.type === "KEYWORD") {
        switch (t.value) {
          case "もし": return this.parseIf();
          case "関数": return this.parseFuncDef();
          case "戻す": return this.parseReturn();
          case "表示": return this.parsePrint();
          case "抜ける":
          case "続ける": return this.parseBreakContinue();
          case "そうでなければ":
            throw err("parse", t.line, t.col,
              "対応する「もし」がないのに「そうでなければ」があります",
              "「もし 〜 ならば」のブロックの中で使ってください。");
          case "おわり":
            throw err("parse", t.line, t.col,
              "対応するブロックがないのに「おわり」があります",
              "余分な「おわり」を削除するか、「もし」「繰り返す」「関数」と対応させてください。");
          case "ならば":
            throw err("parse", t.line, t.col,
              "「もし」がないのに「ならば」があります",
              "「もし 条件 ならば」の形で書いてください。");
          case "回繰り返す":
          case "の間繰り返す":
            throw err("parse", t.line, t.col,
              "「" + t.value + "」の前に式がありません",
              "「5 回繰り返す」「カウンタ < 10 の間繰り返す」のように書いてください。");
          // 真 / 偽 / でない は式として扱う
        }
      }
      return this.parseExprStatement();
    }

    parseIf() {
      var node = this.parseIfChain();
      // else-if連鎖全体を1つの「おわり」で閉じる（仕様§2.2の連鎖注記に従う）
      var endTok = this.peek();
      if (!this.atKw("おわり")) {
        throw err("parse", node.line, node.col,
          "「おわり」が足りません",
          "「もし」「繰り返す」「関数」のブロックは「おわり」で閉じます。");
      }
      this.next();
      this.expectTerminator();
      return node;
    }

    parseIfChain() {
      var moshi = this.next(); // もし
      var cond = this.parseExpr();
      if (!this.atKw("ならば")) {
        throw err("parse", moshi.line, moshi.col,
          "「もし」に対応する「ならば」がありません",
          "条件式のあとに「ならば」を書いてください。");
      }
      this.next();
      this.expectTerminator();
      var thenBody = this.parseStatements(["そうでなければ", "おわり"], moshi);
      var elseBody = null;
      if (this.atKw("そうでなければ")) {
        this.next();
        if (this.atKw("もし")) {
          elseBody = [this.parseIfChain()]; // else-if 連鎖
        } else {
          this.expectTerminator();
          elseBody = this.parseStatements(["おわり"], moshi);
        }
      }
      return { type: "If", cond: cond, then: thenBody, else: elseBody, line: moshi.line, col: moshi.col };
    }

    parseFuncDef() {
      var kw = this.next(); // 関数
      var nameTok = this.peek();
      if (nameTok.type !== "IDENT") {
        throw err("parse", kw.line, kw.col,
          "「関数」のあとに関数名がありません",
          "「関数 あいさつ()」のように関数名を書いてください。");
      }
      this.next();
      this.expectOp("(",
        "関数名のあとに「(」がありません",
        "「関数 " + nameTok.value + "(引数)」のように「(」「)」を書いてください。");
      var params = [];
      if (!this.atOp(")")) {
        for (;;) {
          var p = this.peek();
          if (p.type !== "IDENT") {
            throw err("parse", p.line, p.col,
              "関数の引数には変数名を書いてください",
              "例: 「関数 たす(あ, い)」。");
          }
          this.next();
          params.push(p.value);
          if (this.atOp(",")) { this.next(); continue; }
          break;
        }
      }
      this.expectOp(")",
        "「)」が足りません",
        "関数の引数の並びは「)」で閉じてください。");
      this.expectTerminator();
      var savedLoop = this.loopDepth;
      this.fnDepth++;
      this.loopDepth = 0;
      var body = this.parseStatements(["おわり"], kw);
      this.fnDepth--;
      this.loopDepth = savedLoop;
      this.next(); // おわり
      this.expectTerminator();
      return { type: "FuncDef", name: nameTok.value, params: params, body: body, line: kw.line, col: kw.col };
    }

    parseReturn() {
      var kw = this.next(); // 戻す
      if (this.fnDepth === 0) {
        throw err("parse", kw.line, kw.col,
          "「戻す」は関数の中でしか使えません",
          "「関数 〜」のブロックの中に書いてください。");
      }
      var value = null;
      var t = this.peek();
      if (t.type !== "NEWLINE" && t.type !== "EOF") value = this.parseExpr();
      this.expectTerminator();
      return { type: "Return", value: value, line: kw.line, col: kw.col };
    }

    parsePrint() {
      var kw = this.next(); // 表示
      var t = this.peek();
      if (t.type === "NEWLINE" || t.type === "EOF") {
        throw err("parse", kw.line, kw.col,
          "「表示」のあとに表示する内容がありません",
          "「表示 「こんにちは」」のように式を書いてください。");
      }
      var args = [this.parseExpr()];
      while (this.atOp(",")) {
        this.next();
        args.push(this.parseExpr());
      }
      this.expectTerminator();
      return { type: "Print", args: args, line: kw.line, col: kw.col };
    }

    parseBreakContinue() {
      var kw = this.next(); // 抜ける / 続ける
      if (this.loopDepth === 0) {
        throw err("parse", kw.line, kw.col,
          "「" + kw.value + "」はループの中でしか使えません",
          "「回繰り返す」「の間繰り返す」のブロックの中に書いてください。");
      }
      this.expectTerminator();
      return { type: kw.value === "抜ける" ? "Break" : "Continue", line: kw.line, col: kw.col };
    }

    parseExprStatement() {
      var startTok = this.peek();
      var expr = this.parseExpr();
      var t = this.peek();

      // expr 回繰り返す / expr の間繰り返す
      if (t.type === "KEYWORD" && (t.value === "回繰り返す" || t.value === "の間繰り返す")) {
        this.next();
        this.expectTerminator();
        this.loopDepth++;
        var body = this.parseStatements(["おわり"], startTok);
        this.loopDepth--;
        this.next(); // おわり
        this.expectTerminator();
        if (t.value === "回繰り返す") {
          return { type: "Repeat", count: expr, body: body, line: startTok.line, col: startTok.col };
        }
        return { type: "While", cond: expr, body: body, line: startTok.line, col: startTok.col };
      }

      // 代入
      if (t.type === "OP" && t.value === "=") {
        this.next();
        var value = this.parseExpr();
        this.expectTerminator();
        if (expr.type === "Ident") {
          return { type: "Assign", target: expr.name, value: value, line: startTok.line, col: startTok.col };
        }
        if (expr.type === "Index") {
          return { type: "IndexAssign", object: expr.object, index: expr.index, value: value, line: startTok.line, col: startTok.col };
        }
        throw err("parse", t.line, t.col,
          "「=」の左側には変数か、配列・辞書の要素を書いてください",
          "例: 「合計 = 0」「表[0] = 1」。");
      }

      this.expectTerminator();
      return { type: "ExprStmt", expr: expr, line: startTok.line, col: startTok.col };
    }

    // ---- 式（優先順位: または < かつ < でない < 比較 < +- < */% < 単項- < 呼出/添字） ----
    parseExpr() { return this.parseOr(); }

    parseOr() {
      var left = this.parseAnd();
      while (this.atKw("または")) {
        var t = this.next();
        var right = this.parseAnd();
        left = { type: "Binary", op: "または", left: left, right: right, line: t.line, col: t.col };
      }
      return left;
    }

    parseAnd() {
      var left = this.parseNot();
      while (this.atKw("かつ")) {
        var t = this.next();
        var right = this.parseNot();
        left = { type: "Binary", op: "かつ", left: left, right: right, line: t.line, col: t.col };
      }
      return left;
    }

    parseNot() {
      if (this.atKw("でない")) {
        var t = this.next();
        var operand = this.parseNot();
        return { type: "Unary", op: "でない", operand: operand, line: t.line, col: t.col };
      }
      return this.parseComparison();
    }

    atCompareOp() {
      var t = this.peek();
      return t.type === "OP" && COMPARE_OPS[t.value] === 1;
    }

    parseComparison() {
      var left = this.parseAdditive();
      if (this.atCompareOp()) {
        var t = this.next();
        var right = this.parseAdditive();
        left = { type: "Binary", op: t.value, left: left, right: right, line: t.line, col: t.col };
        if (this.atCompareOp()) {
          var t2 = this.peek();
          throw err("parse", t2.line, t2.col,
            "比較演算子は続けて使えません",
            "「あ < い かつ い < う」のように「かつ」で分けて書いてください。");
        }
      }
      return left;
    }

    parseAdditive() {
      var left = this.parseMultiplicative();
      for (;;) {
        var t = this.peek();
        if (t.type === "OP" && (t.value === "+" || t.value === "-")) {
          this.next();
          var right = this.parseMultiplicative();
          left = { type: "Binary", op: t.value, left: left, right: right, line: t.line, col: t.col };
        } else break;
      }
      return left;
    }

    parseMultiplicative() {
      var left = this.parseUnary();
      for (;;) {
        var t = this.peek();
        if (t.type === "OP" && (t.value === "*" || t.value === "/" || t.value === "%")) {
          this.next();
          var right = this.parseUnary();
          left = { type: "Binary", op: t.value, left: left, right: right, line: t.line, col: t.col };
        } else break;
      }
      return left;
    }

    parseUnary() {
      if (this.atOp("-")) {
        var t = this.next();
        var operand = this.parseUnary();
        return { type: "Unary", op: "-", operand: operand, line: t.line, col: t.col };
      }
      return this.parsePostfix();
    }

    parsePostfix() {
      var expr = this.parsePrimary();
      for (;;) {
        if (this.atOp("(")) {
          var open = this.next();
          var args = [];
          if (!this.atOp(")")) {
            args.push(this.parseExpr());
            while (this.atOp(",")) {
              this.next();
              args.push(this.parseExpr());
            }
          }
          this.expectOp(")",
            "「)」が足りません",
            "関数の引数の並びは「)」で閉じてください。");
          expr = { type: "Call", callee: expr, args: args, line: open.line, col: open.col };
        } else if (this.atOp("[")) {
          var openB = this.next();
          var index = this.parseExpr();
          this.expectOp("]",
            "「]」が足りません",
            "添字は「]」で閉じてください。");
          expr = { type: "Index", object: expr, index: index, line: openB.line, col: openB.col };
        } else break;
      }
      return expr;
    }

    parsePrimary() {
      var t = this.peek();
      if (t.type === "NUMBER") {
        this.next();
        return { type: "NumberLit", value: t.value, line: t.line, col: t.col };
      }
      if (t.type === "STRING") {
        this.next();
        return { type: "StringLit", value: t.value, line: t.line, col: t.col };
      }
      if (t.type === "KEYWORD" && (t.value === "真" || t.value === "偽")) {
        this.next();
        return { type: "BoolLit", value: t.value === "真", line: t.line, col: t.col };
      }
      if (t.type === "IDENT") {
        this.next();
        return { type: "Ident", name: t.value, line: t.line, col: t.col };
      }
      if (t.type === "OP" && t.value === "(") {
        this.next();
        var inner = this.parseExpr();
        this.expectOp(")",
          "「)」が足りません",
          "式は「)」で閉じてください。");
        return inner;
      }
      if (t.type === "OP" && t.value === "[") {
        // 配列リテラル
        this.next();
        var elements = [];
        if (!this.atOp("]")) {
          elements.push(this.parseExpr());
          while (this.atOp(",")) {
            this.next();
            elements.push(this.parseExpr());
          }
        }
        this.expectOp("]",
          "「]」が足りません",
          "配列は「]」で閉じてください。");
        return { type: "ArrayLit", elements: elements, line: t.line, col: t.col };
      }
      if (t.type === "OP" && t.value === "{") {
        // 辞書リテラル
        this.next();
        var entries = [];
        if (!this.atOp("}")) {
          for (;;) {
            var keyTok = this.peek();
            if (keyTok.type !== "STRING") {
              throw err("parse", keyTok.line, keyTok.col,
                "辞書のキーは「…」の文字列で書いてください",
                "例: 「{「国語」: 80}」。");
            }
            this.next();
            this.expectOp(":",
              "辞書のキーのあとに「:」がありません",
              "「{「キー」: 値}」の形で書いてください。");
            var val = this.parseExpr();
            entries.push({ key: keyTok.value, value: val });
            if (this.atOp(",")) { this.next(); continue; }
            break;
          }
        }
        this.expectOp("}",
          "「}」が足りません",
          "辞書は「}」で閉じてください。");
        return { type: "DictLit", entries: entries, line: t.line, col: t.col };
      }
      if (t.type === "NEWLINE" || t.type === "EOF") {
        throw err("parse", t.line, t.col,
          "式が必要なところで行が終わっています",
          "数値・文字列・変数などの式を書いてください。");
      }
      throw err("parse", t.line, t.col,
        "ここで" + this.tokenLabel(t) + "は使えません",
        "数値・文字列・変数などの式を書いてください。");
    }
  }

  function parseSource(source) {
    var tokens = tokenize(source, { tolerant: false });
    return new Parser(tokens).parseProgram();
  }

  // =====================================================================
  // 値の表示・比較・型名
  // =====================================================================
  function typeName(v) {
    if (typeof v === "number") return "数値";
    if (typeof v === "string") return "文字列";
    if (typeof v === "boolean") return "真偽値";
    if (Array.isArray(v)) return "配列";
    if (v instanceof Map) return "辞書";
    if (v && (v.kfunc || v.builtin)) return "関数";
    return "不明な値";
  }

  // quote=true のとき文字列を「…」で囲む（配列・辞書の中身や変数ウォッチ用）
  function display(v, quote, seen) {
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return quote ? "「" + v + "」" : v;
    if (typeof v === "boolean") return v ? "真" : "偽";
    if (Array.isArray(v)) {
      seen = seen || new Set();
      if (seen.has(v)) return "[…]";
      seen.add(v);
      var parts = [];
      for (var i = 0; i < v.length; i++) parts.push(display(v[i], true, seen));
      seen.delete(v);
      return "[" + parts.join("、") + "]"; // 、区切り
    }
    if (v instanceof Map) {
      seen = seen || new Set();
      if (seen.has(v)) return "{…}";
      seen.add(v);
      var pairs = [];
      v.forEach(function (val, key) {
        pairs.push("「" + key + "」：" + display(val, true, seen)); // 「キー」：値
      });
      seen.delete(v);
      return "{" + pairs.join("、") + "}";
    }
    if (v && v.kfunc) return "関数 " + v.name;
    if (v && v.builtin) return "組み込み関数 " + v.name;
    return String(v);
  }

  function deepEq(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEq(a[i], b[i])) return false;
      return true;
    }
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      var ok = true;
      a.forEach(function (val, key) {
        if (!b.has(key) || !deepEq(val, b.get(key))) ok = false;
      });
      return ok;
    }
    return false;
  }

  // =====================================================================
  // スコープ（グローバル＋関数ローカル。ブロックはスコープを作らない）
  // =====================================================================
  class Scope {
    constructor(parent) {
      this.vars = new Map();
      this.parent = parent;
    }
    lookup(name) {
      var s = this;
      while (s) {
        if (s.vars.has(name)) return { found: true, value: s.vars.get(name) };
        s = s.parent;
      }
      return { found: false, value: undefined };
    }
    set(name, value) {
      // 仕様: 関数内での代入は常にローカル変数を作る/更新する
      this.vars.set(name, value);
    }
  }

  // =====================================================================
  // 組み込み関数
  // =====================================================================
  var BUILTINS = new Map();
  function defBuiltin(name, arity, fn) {
    BUILTINS.set(name, { builtin: true, name: name, arity: arity, fn: fn });
  }

  function rerr(node, cause, hint) {
    return err("runtime", node.line, node.col, cause, hint);
  }

  defBuiltin("長さ", 1, function (args, node) {
    var x = args[0];
    if (typeof x === "string") return Array.from(x).length;
    if (Array.isArray(x)) return x.length;
    if (x instanceof Map) return x.size;
    throw rerr(node, "「長さ」には文字列・配列・辞書を渡してください",
      "例: 長さ(「あいう」)、長さ([1, 2, 3])。");
  });

  defBuiltin("追加", 2, function (args, node) {
    var arr = args[0];
    if (!Array.isArray(arr)) {
      throw rerr(node, "「追加」の1つ目には配列を渡してください",
        "例: 追加(表, 4)。");
    }
    arr.push(args[1]);
    return arr;
  });

  defBuiltin("数値", 1, function (args, node) {
    var x = args[0];
    if (typeof x === "number") return x;
    if (typeof x === "string") {
      var normalized = "";
      for (var i = 0; i < x.length; i++) normalized += normChar(x[i]);
      normalized = normalized.trim();
      var num = Number(normalized);
      if (normalized === "" || isNaN(num)) {
        throw rerr(node, "「" + x + "」は数値に変換できません",
          "半角または全角の数字の文字列を渡してください。");
      }
      return num;
    }
    throw rerr(node, typeName(x) + "は「数値」で変換できません",
      "数値にしたい文字列を渡してください。");
  });

  defBuiltin("文字列", 1, function (args) {
    return display(args[0], false);
  });

  defBuiltin("キー一覧", 1, function (args, node) {
    var d = args[0];
    if (!(d instanceof Map)) {
      throw rerr(node, "「キー一覧」には辞書を渡してください",
        "例: キー一覧({「国語」: 80})。");
    }
    return Array.from(d.keys());
  });

  // =====================================================================
  // インタプリタ（ジェネレータによるツリーウォーク）
  // =====================================================================
  function makeCtx(maxSteps, onOutput) {
    var global = new Scope(null);
    return {
      maxSteps: maxSteps,
      steps: 0,
      line: null,
      output: [],
      onOutput: onOutput || null,
      global: global,
      frames: [{ name: "(メイン)", line: 1, scope: global }]
    };
  }

  function bumpStep(ctx, line) {
    ctx.steps++;
    if (ctx.steps > ctx.maxSteps) {
      // §2.3の規定文言（行番号プレフィックスなし）
      throw new KotonohaError("step-limit", line, null,
        "実行ステップの上限（" + ctx.maxSteps + "回）に達しました。無限ループになっていないか確認してください。",
        "無限ループになっていないか確認してください。");
    }
  }

  function requireBool(v, node, label) {
    if (typeof v !== "boolean") {
      throw rerr(node, label + "は真か偽になる式を書いてください",
        "比較（== < > など）や「かつ」「または」を使ってください。");
    }
  }

  function topFrame(ctx) {
    return ctx.frames[ctx.frames.length - 1];
  }

  function getIndex(obj, idx, node) {
    if (Array.isArray(obj)) {
      if (typeof idx !== "number" || !Number.isInteger(idx)) {
        throw rerr(node, "配列の添字は整数で指定してください",
          "例: 表[0]。添字は0から始まります。");
      }
      if (idx < 0 || idx >= obj.length) {
        throw rerr(node, "配列の" + idx + "番目は存在しません（要素数" + obj.length + "）",
          "添字は0から" + (obj.length - 1) + "の範囲で指定してください。");
      }
      return obj[idx];
    }
    if (obj instanceof Map) {
      if (typeof idx !== "string") {
        throw rerr(node, "辞書のキーは文字列で指定してください",
          "例: 成績[「国語」]。");
      }
      if (!obj.has(idx)) {
        throw rerr(node, "辞書にキー「" + idx + "」がありません",
          "「キー一覧(…)」でキーを確認してください。");
      }
      return obj.get(idx);
    }
    if (typeof obj === "string") {
      var chars = Array.from(obj);
      if (typeof idx !== "number" || !Number.isInteger(idx)) {
        throw rerr(node, "文字列の添字は整数で指定してください",
          "例: 文字[0]。添字は0から始まります。");
      }
      if (idx < 0 || idx >= chars.length) {
        throw rerr(node, "文字列の" + idx + "番目は存在しません（文字数" + chars.length + "）",
          "添字は0から" + (chars.length - 1) + "の範囲で指定してください。");
      }
      return chars[idx];
    }
    throw rerr(node, typeName(obj) + "には添字「[…]」が使えません",
      "添字は配列・辞書・文字列にだけ使えます。");
  }

  function setIndex(obj, idx, value, node) {
    if (Array.isArray(obj)) {
      if (typeof idx !== "number" || !Number.isInteger(idx)) {
        throw rerr(node, "配列の添字は整数で指定してください",
          "例: 表[0] = 1。添字は0から始まります。");
      }
      if (idx < 0 || idx >= obj.length) {
        throw rerr(node, "配列の" + idx + "番目は存在しません（要素数" + obj.length + "）",
          "要素を増やすときは「追加(配列, 値)」を使ってください。");
      }
      obj[idx] = value;
      return;
    }
    if (obj instanceof Map) {
      if (typeof idx !== "string") {
        throw rerr(node, "辞書のキーは文字列で指定してください",
          "例: 成績[「英語」] = 70。");
      }
      obj.set(idx, value);
      return;
    }
    throw rerr(node, typeName(obj) + "の要素には代入できません",
      "添字への代入は配列・辞書にだけ使えます。");
  }

  function applyBinary(node, l, r) {
    var op = node.op;
    switch (op) {
      case "+":
        if (typeof l === "number" && typeof r === "number") return l + r;
        if (typeof l === "string" || typeof r === "string") {
          return display(l, false) + display(r, false);
        }
        throw rerr(node, "「+」は数値どうしの足し算か、文字列の連結にしか使えません",
          "値の型（" + typeName(l) + "と" + typeName(r) + "）を確認してください。");
      case "-":
      case "*":
      case "/":
      case "%":
        if (typeof l !== "number" || typeof r !== "number") {
          if ((typeof l === "string" && typeof r === "number") ||
              (typeof l === "number" && typeof r === "string")) {
            throw rerr(node, "文字列と数値は「" + op + "」で計算できません",
              "「数値(…)」で変換してください。");
          }
          throw rerr(node, "「" + op + "」は数値どうしでしか計算できません",
            "値の型（" + typeName(l) + "と" + typeName(r) + "）を確認してください。");
        }
        if ((op === "/" || op === "%") && r === 0) {
          throw rerr(node, "0で割ることはできません",
            "割る数が0にならないようにしてください。");
        }
        if (op === "-") return l - r;
        if (op === "*") return l * r;
        if (op === "/") return l / r;
        return l % r;
      case "==": return deepEq(l, r);
      case "!=": return !deepEq(l, r);
      default: // < <= > >=
        if ((typeof l === "number" && typeof r === "number") ||
            (typeof l === "string" && typeof r === "string")) {
          if (op === "<") return l < r;
          if (op === "<=") return l <= r;
          if (op === ">") return l > r;
          return l >= r;
        }
        throw rerr(node, "「" + op + "」は数値どうしか文字列どうしでしか比べられません",
          "値の型（" + typeName(l) + "と" + typeName(r) + "）を確認してください。");
    }
  }

  function* evalExpr(e, ctx, scope) {
    switch (e.type) {
      case "NumberLit": return e.value;
      case "StringLit": return e.value;
      case "BoolLit": return e.value;
      case "Ident": {
        var r = scope.lookup(e.name);
        if (r.found) return r.value;
        if (BUILTINS.has(e.name)) return BUILTINS.get(e.name);
        throw rerr(e, "変数「" + e.name + "」はまだ作られていません",
          "先に「" + e.name + " = 0」のように代入してください。");
      }
      case "Unary": {
        var v = yield* evalExpr(e.operand, ctx, scope);
        if (e.op === "-") {
          if (typeof v !== "number") {
            throw rerr(e, "「-」は数値にしか使えません",
              "値の型（" + typeName(v) + "）を確認してください。");
          }
          return -v;
        }
        // でない
        if (typeof v !== "boolean") {
          throw rerr(e, "「でない」には真か偽を使ってください",
            "比較（== < > など）の式を書いてください。");
        }
        return !v;
      }
      case "Binary": {
        if (e.op === "かつ" || e.op === "または") {
          var lv = yield* evalExpr(e.left, ctx, scope);
          if (typeof lv !== "boolean") {
            throw rerr(e, "「" + e.op + "」の左側は真か偽でなければなりません",
              "比較（== < > など）の式を書いてください。");
          }
          if (e.op === "かつ" && !lv) return false;
          if (e.op === "または" && lv) return true;
          var rv = yield* evalExpr(e.right, ctx, scope);
          if (typeof rv !== "boolean") {
            throw rerr(e, "「" + e.op + "」の右側は真か偽でなければなりません",
              "比較（== < > など）の式を書いてください。");
          }
          return rv;
        }
        var l = yield* evalExpr(e.left, ctx, scope);
        var rr = yield* evalExpr(e.right, ctx, scope);
        return applyBinary(e, l, rr);
      }
      case "Call": {
        var fnVal;
        var calleeName = e.callee.type === "Ident" ? e.callee.name : null;
        if (calleeName !== null) {
          var found = scope.lookup(calleeName);
          if (found.found) fnVal = found.value;
          else if (BUILTINS.has(calleeName)) fnVal = BUILTINS.get(calleeName);
          else {
            throw rerr(e, "関数「" + calleeName + "」は定義されていません",
              "「関数 " + calleeName + "(…)」で先に定義するか、名前を確認してください。");
          }
        } else {
          fnVal = yield* evalExpr(e.callee, ctx, scope);
        }
        var args = [];
        for (var ai = 0; ai < e.args.length; ai++) {
          args.push(yield* evalExpr(e.args[ai], ctx, scope));
        }
        if (fnVal && fnVal.builtin) {
          if (args.length !== fnVal.arity) {
            throw rerr(e, "「" + fnVal.name + "」の引数の数が違います",
              fnVal.arity + "個の引数を渡してください。");
          }
          return fnVal.fn(args, e, ctx);
        }
        if (fnVal && fnVal.kfunc) {
          if (args.length !== fnVal.params.length) {
            throw rerr(e, "関数「" + fnVal.name + "」の引数の数が違います",
              fnVal.params.length + "個の引数を渡してください。");
          }
          if (ctx.frames.length >= MAX_CALL_DEPTH) {
            throw rerr(e, "関数の呼び出しが深くなりすぎました",
              "再帰の終了条件（「もし 〜 ならば 戻す 〜」）を確認してください。");
          }
          var fnScope = new Scope(fnVal.closure);
          for (var pi = 0; pi < fnVal.params.length; pi++) {
            fnScope.set(fnVal.params[pi], args[pi]);
          }
          ctx.frames.push({ name: fnVal.name, line: e.line, scope: fnScope });
          var sig;
          try {
            sig = yield* execStmts(fnVal.body, ctx, fnScope);
          } finally {
            ctx.frames.pop();
          }
          // 「戻す」省略時・関数末尾到達時の戻り値は偽（v1仕様）
          return sig && sig.type === "return" ? sig.value : false;
        }
        throw rerr(e,
          (calleeName !== null ? "「" + calleeName + "」" : typeName(fnVal)) + "は関数ではありません",
          "関数名と「()」の使い方を確認してください。");
      }
      case "Index": {
        var obj = yield* evalExpr(e.object, ctx, scope);
        var idx = yield* evalExpr(e.index, ctx, scope);
        return getIndex(obj, idx, e);
      }
      case "ArrayLit": {
        var arr = [];
        for (var ei = 0; ei < e.elements.length; ei++) {
          arr.push(yield* evalExpr(e.elements[ei], ctx, scope));
        }
        return arr;
      }
      case "DictLit": {
        var m = new Map();
        for (var di = 0; di < e.entries.length; di++) {
          var entry = e.entries[di];
          m.set(entry.key, yield* evalExpr(entry.value, ctx, scope));
        }
        return m;
      }
      default:
        throw rerr(e, "内部エラー: 未知の式（" + e.type + "）です",
          "この現象を報告してください。");
    }
  }

  function* execStmts(stmts, ctx, scope) {
    for (var i = 0; i < stmts.length; i++) {
      var sig = yield* execStmt(stmts[i], ctx, scope);
      if (sig) return sig;
    }
    return null;
  }

  function* execStmt(s, ctx, scope) {
    ctx.line = s.line;
    topFrame(ctx).line = s.line;
    yield s; // ステッパの一時停止点（この文を実行する直前）
    bumpStep(ctx, s.line);

    switch (s.type) {
      case "Assign": {
        var av = yield* evalExpr(s.value, ctx, scope);
        scope.set(s.target, av);
        return null;
      }
      case "IndexAssign": {
        var obj = yield* evalExpr(s.object, ctx, scope);
        var idx = yield* evalExpr(s.index, ctx, scope);
        var val = yield* evalExpr(s.value, ctx, scope);
        setIndex(obj, idx, val, s);
        return null;
      }
      case "If": {
        var cond = yield* evalExpr(s.cond, ctx, scope);
        requireBool(cond, s, "「もし」の条件");
        if (cond) return yield* execStmts(s.then, ctx, scope);
        if (s.else) return yield* execStmts(s.else, ctx, scope);
        return null;
      }
      case "Repeat": {
        var countV = yield* evalExpr(s.count, ctx, scope);
        if (typeof countV !== "number") {
          throw rerr(s, "「回繰り返す」の回数は数値で書いてください",
            "例: 「5 回繰り返す」。");
        }
        var times = Math.floor(countV);
        for (var k = 0; k < times; k++) {
          if (k > 0) {
            // 2周目以降もループ行で一時停止し、1ステップとして数える
            ctx.line = s.line;
            topFrame(ctx).line = s.line;
            yield s;
            bumpStep(ctx, s.line);
          }
          var sigR = yield* execStmts(s.body, ctx, scope);
          if (sigR) {
            if (sigR.type === "break") break;
            if (sigR.type !== "continue") return sigR;
          }
        }
        return null;
      }
      case "While": {
        var firstIter = true;
        for (;;) {
          if (!firstIter) {
            // 条件の再評価も1ステップ（空ボディの無限ループでもガードが効く）
            ctx.line = s.line;
            topFrame(ctx).line = s.line;
            yield s;
            bumpStep(ctx, s.line);
          }
          firstIter = false;
          var wc = yield* evalExpr(s.cond, ctx, scope);
          requireBool(wc, s, "「の間繰り返す」の条件");
          if (!wc) break;
          var sigW = yield* execStmts(s.body, ctx, scope);
          if (sigW) {
            if (sigW.type === "break") break;
            if (sigW.type !== "continue") return sigW;
          }
        }
        return null;
      }
      case "FuncDef": {
        scope.set(s.name, {
          kfunc: true, name: s.name, params: s.params, body: s.body, closure: scope
        });
        return null;
      }
      case "Return": {
        var rv = s.value !== null ? yield* evalExpr(s.value, ctx, scope) : false;
        return { type: "return", value: rv };
      }
      case "Print": {
        var parts = [];
        for (var pi = 0; pi < s.args.length; pi++) {
          parts.push(display(yield* evalExpr(s.args[pi], ctx, scope), false));
        }
        var lineStr = parts.join("");
        ctx.output.push(lineStr);
        if (ctx.onOutput) ctx.onOutput(lineStr);
        return null;
      }
      case "Break": return { type: "break" };
      case "Continue": return { type: "continue" };
      case "ExprStmt": {
        yield* evalExpr(s.expr, ctx, scope);
        return null;
      }
      default:
        throw rerr(s, "内部エラー: 未知の文（" + s.type + "）です",
          "この現象を報告してください。");
    }
  }

  function* execProgram(ast, ctx) {
    yield* execStmts(ast.body, ctx, ctx.global);
  }

  // =====================================================================
  // 公開API: run / createStepper
  // =====================================================================
  function normMaxSteps(v) {
    return typeof v === "number" && isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_MAX_STEPS;
  }

  function wrapInternal(ex, line) {
    var msg = ex && ex.message ? String(ex.message) : String(ex);
    return new KotonohaError("runtime", line == null ? null : line, null,
      (line == null ? "" : line + "行目: ") + "内部エラーが発生しました（" + msg + "）。プログラムを見直すか、この現象を報告してください。",
      "プログラムを見直すか、この現象を報告してください。");
  }

  function globalsObj(ctx) {
    var o = {};
    ctx.global.vars.forEach(function (value, name) { o[name] = value; });
    return o;
  }

  function run(source, opts) {
    opts = opts || {};
    var maxSteps = normMaxSteps(opts.maxSteps);
    var onOutput = typeof opts.onOutput === "function" ? opts.onOutput : null;
    var ctx = makeCtx(maxSteps, onOutput);
    try {
      var ast = parseSource(source);
      var it = execProgram(ast, ctx);
      while (!it.next().done) { /* 実行を進める */ }
      return { ok: true, output: ctx.output, steps: ctx.steps, error: null, globals: globalsObj(ctx) };
    } catch (ex) {
      var ke = ex instanceof KotonohaError ? ex : wrapInternal(ex, ctx.line);
      return { ok: false, output: ctx.output, steps: ctx.steps, error: ke, globals: globalsObj(ctx) };
    }
  }

  function buildStepState(ctx, done, error, line) {
    var variables = [];
    for (var i = 0; i < ctx.frames.length; i++) {
      var f = ctx.frames[i];
      var label = i === 0 ? "グローバル" : f.name;
      f.scope.vars.forEach(function (value, name) {
        variables.push({ scope: label, name: name, value: display(value, true) });
      });
    }
    return {
      done: done,
      line: line == null ? null : line,
      output: ctx.output.slice(),
      variables: variables,
      callStack: ctx.frames.map(function (f) { return { name: f.name, line: f.line }; }),
      steps: ctx.steps,
      error: error || null
    };
  }

  function createStepper(source, opts) {
    opts = opts || {};
    var ast = parseSource(source); // 仕様: parse失敗時は KotonohaError を throw
    var maxSteps = normMaxSteps(opts.maxSteps);

    var ctx, it, curState, finalState;

    function init() {
      ctx = makeCtx(maxSteps, null);
      it = execProgram(ast, ctx);
      finalState = null;
      curState = null;
      try {
        var r = it.next(); // 最初の文の直前まで進める（まだ何も実行しない）
        if (r.done) {
          finalState = buildStepState(ctx, true, null, null);
        } else {
          curState = buildStepState(ctx, false, null, r.value.line);
        }
      } catch (ex) {
        var ke = ex instanceof KotonohaError ? ex : wrapInternal(ex, ctx.line);
        finalState = buildStepState(ctx, true, ke, ctx.line);
      }
    }

    init();

    return {
      // 1文実行して状態を返す。done後の呼び出しは同じ最終状態を返す
      step: function () {
        if (finalState) return finalState;
        try {
          var r = it.next();
          if (r.done) {
            finalState = buildStepState(ctx, true, null, null);
            return finalState;
          }
          curState = buildStepState(ctx, false, null, r.value.line);
          return curState;
        } catch (ex) {
          var ke = ex instanceof KotonohaError ? ex : wrapInternal(ex, ctx.line);
          finalState = buildStepState(ctx, true, ke, ctx.line);
          return finalState;
        }
      },
      // 実行せず現在状態を返す
      getState: function () {
        return finalState || curState;
      },
      reset: function () {
        init();
      }
    };
  }

  // =====================================================================
  // 公開
  // =====================================================================
  var Kotonoha = {
    VERSION: "1.0.0",
    tokenize: tokenize,
    parse: parseSource,
    run: run,
    createStepper: createStepper,
    KotonohaError: KotonohaError
  };

  if (typeof window !== "undefined") {
    window.Kotonoha = Kotonoha;
  } else if (typeof globalThis !== "undefined") {
    globalThis.Kotonoha = Kotonoha;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Kotonoha;
  }
})();
