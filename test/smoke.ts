// CodeRunner smoke test — runs real compilers/interpreters on the CI matrix
// (ubuntu / windows / macos) to verify cross-platform toolchain detection,
// execution, and memory measurement.
//
// Usage: npx esbuild test/smoke.ts --bundle --platform=node --outfile=out/smoke.js && node out/smoke.js

import { run, runProgrammers } from '../src/services/codeRunner';
import { Language } from '../src/models/models';

interface Case {
  name: string;
  required: boolean;
  exec: () => Promise<{ output: string; error: string; exitCode: number; peakMemoryKB: number }>;
  expect: string;
}

const CASES: Case[] = [
  {
    name: 'python stdin',
    required: true,
    exec: () => run('print(int(input()) * 2)', Language.PYTHON, '21'),
    expect: '42',
  },
  {
    name: 'cpp stdin',
    required: true,
    exec: () => run(
      '#include <iostream>\nint main() { int n; std::cin >> n; std::cout << n * 2 << std::endl; return 0; }',
      Language.CPP, '21',
    ),
    expect: '42',
  },
  {
    name: 'java stdin',
    required: true,
    exec: () => run(
      'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    System.out.println(sc.nextInt() * 2);\n  }\n}',
      Language.JAVA, '21',
    ),
    expect: '42',
  },
  {
    name: 'javascript stdin',
    required: true,
    exec: () => run(
      "let d = '';\nprocess.stdin.on('data', c => d += c);\nprocess.stdin.on('end', () => console.log(parseInt(d) * 2));",
      Language.JAVASCRIPT, '21',
    ),
    expect: '42',
  },
  {
    name: 'rust stdin',
    required: false,
    exec: () => run(
      'use std::io::Read;\nfn main() {\n    let mut s = String::new();\n    std::io::stdin().read_to_string(&mut s).unwrap();\n    println!("{}", s.trim().parse::<i64>().unwrap() * 2);\n}',
      Language.RUST, '21',
    ),
    expect: '42',
  },
  {
    name: 'go stdin',
    required: false,
    exec: () => run(
      'package main\n\nimport "fmt"\n\nfunc main() {\n    var n int\n    fmt.Scan(&n)\n    fmt.Println(n * 2)\n}',
      Language.GO, '21',
    ),
    expect: '42',
  },
  {
    name: 'ruby stdin',
    required: false,
    exec: () => run('puts gets.to_i * 2', Language.RUBY, '21'),
    expect: '42',
  },
  {
    name: 'kotlin stdin',
    required: false,
    exec: () => run(
      'fun main() {\n    println(readLine()!!.trim().toInt() * 2)\n}',
      Language.KOTLIN, '21',
    ),
    expect: '42',
  },
  {
    name: 'python function mode (Programmers-style wrapper)',
    required: true,
    exec: () => runProgrammers('def solution(a, b):\n    return a + b', Language.PYTHON, '3\n4', ['a', 'b']),
    expect: '7',
  },
];

async function main(): Promise<void> {
  let failed = 0;

  for (const c of CASES) {
    let result;
    try {
      result = await c.exec();
    } catch (e: any) {
      console.log(`FAIL ${c.name}: threw ${e.message}`);
      failed++;
      continue;
    }

    if (result.error.includes('not found')) {
      if (c.required) {
        console.log(`FAIL ${c.name}: toolchain missing — ${result.error.split('\n')[0]}`);
        failed++;
      } else {
        console.log(`SKIP ${c.name}: toolchain not installed on this runner`);
      }
      continue;
    }

    if (result.exitCode === 0 && result.output.trim() === c.expect) {
      console.log(`PASS ${c.name} (${result.output.trim()}, mem ${result.peakMemoryKB}KB)`);
    } else {
      console.log(`FAIL ${c.name}: exit=${result.exitCode} out=${JSON.stringify(result.output)} err=${JSON.stringify(result.error.slice(0, 300))}`);
      failed++;
    }
  }

  // Memory measurement: allocate ~50MB and stay alive long enough for at
  // least one poll on every platform (Windows PowerShell polls every 500ms).
  const mem = await run(
    'import time\na = bytearray(50 * 1024 * 1024)\ntime.sleep(1.5)\nprint(len(a) // 1048576)',
    Language.PYTHON, '',
  );
  if (mem.exitCode === 0 && mem.output.trim() === '50' && mem.peakMemoryKB > 30000) {
    console.log(`PASS memory measurement (peak ${mem.peakMemoryKB}KB for a 50MB allocation)`);
  } else {
    console.log(`FAIL memory measurement: exit=${mem.exitCode} out=${JSON.stringify(mem.output)} peakKB=${mem.peakMemoryKB} err=${JSON.stringify(mem.error.slice(0, 300))}`);
    failed++;
  }

  if (failed > 0) {
    console.log(`\n${failed} case(s) failed`);
    process.exit(1);
  }
  console.log('\nAll smoke cases passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
