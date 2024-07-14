import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <h1>Vitest StackTrace</h1>
    <section class="left">
        <h2>Stack Trace</h2>
        <form id="parser">
            <label>
                <span>Stack Trace:</span>
                <textarea id="source" rows="25" cols="75"></textarea>
            </label>
            <div class="buttons">
                <button id="parse-old" type="button">Old Parser</button>
                <button id="parse-new" type="button">New Parser</button>
                <button id="compare" type="button">Compare</button>
                <button id="clear-results" type="button">Clear Results</button>
                <button id="clear" type="reset">Clear All</button>
            </div>
        </form>
    </section>
    <section class="right">
        <h2>Results</h2>
        <ol id="results"></ol>
    </section>    
</section>
  </main>
`

type ParserMode = 'old' | 'new' | 'compare'
interface StackTraceLine {
    time: number
    file: string
    method: string
    line: number
    column: number
}
interface StackTraceLineResult {
    line: string
    old?: StackTraceLine
    new?: StackTraceLine
}
type Result = StackTraceLineResult[]

document.addEventListener('DOMContentLoaded', () => {
    const source = document.querySelector('#source') as HTMLTextAreaElement
    const parser = document.querySelector('#parser') as HTMLFormElement
    const parseOld = document.querySelector('#parse-old') as HTMLButtonElement
    const parseNew = document.querySelector('#parse-new') as HTMLButtonElement
    const compare = document.querySelector('#compare') as HTMLButtonElement
    const clearResults = document.querySelector('#clear-results') as HTMLButtonElement
    const clear = document.querySelector('#clear') as HTMLButtonElement
    const results = document.querySelector('#results') as HTMLOListElement

    function printResult(result: Result) {
        console.log(result)
        results.replaceChildren()
        result.map((line) => {
            const li = document.createElement('li')
            const pre = document.createElement('pre')
            if (line.old && line.new) {
                pre.appendChild(document.createTextNode(`${JSON.stringify({
                    source: line.line,
                    time: { old: line.old.time, new: line.new.time },
                    file: { old: line.old.file, new: line.new.file },
                    method: { old: line.old.method, new: line.new.method },
                    line: { old: line.old.line, new: line.new.line },
                    column: { old: line.old.column, new: line.new.column },
                }, null, 2)}`))
            } else {
                pre.appendChild(document.createTextNode(`${JSON.stringify(line.old || line.new, null, 2)}`))
            }
            li.appendChild(pre)
            return li
        }).forEach(li => results.appendChild(li))
    }

    function reset() {
        printResult([])
        source.value = ''
        source.focus()
    }

    function newExtractLocation(urlLike: string) {
        let url = urlLike
        if (url.startsWith('http:') || url.startsWith('https:')) {
            const urlObj = new URL(url)
            url = urlObj.pathname
        }
        if (url.startsWith('/@fs/')) {
            const isWindows = /^\/@fs\/[a-zA-Z]:\//.test(url)
            url = urlLike.slice(isWindows ? 5 : 4)
        }

        return url
    }

    function oldExtractLocation(urlLike: string) {
        // Fail-fast but return locations like "(native)"
        if (!urlLike.includes(':')) {
            return [urlLike]
        }

        const regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/
        const parts = regExp.exec(urlLike.replace(/^\(|\)$/g, ''))
        if (!parts) {
            return [urlLike]
        }
        let url = parts[1]
        if (url.startsWith('async ')) {
            url = url.slice(6)
        }
        if (url.startsWith('http:') || url.startsWith('https:')) {
            const urlObj = new URL(url)
            url = urlObj.pathname
        }
        if (url.startsWith('/@fs/')) {
            const isWindows = /^\/@fs\/[a-zA-Z]:\//.test(url)
            url = url.slice(isWindows ? 5 : 4)
        }
        return [url, parts[2] || undefined, parts[3] || undefined]
    }

    function parse(mode: ParserMode) {
        const stackTrace = source.value
        return stackTrace.split('\n').reduce((acc, line) => {
            if (!line.includes('@') && !line.includes(':')) {
                return acc
            }
            const result: StackTraceLineResult = { line }
            if (mode !== 'new') {
                const start = performance.now()
                const functionNameRegex = /((.*".+"[^@]*)?[^@]*)(@)/
                const matches = line.match(functionNameRegex)
                const functionName = matches && matches[1] ? matches[1] : undefined
                const [url, lineNumber, columnNumber] = oldExtractLocation(
                    line.replace(functionNameRegex, ''),
                )
                if (url && lineNumber && columnNumber) {
                    result.old = {
                        time: performance.now() - start,
                        file: url,
                        method: functionName || '',
                        line: Number.parseInt(lineNumber),
                        column: Number.parseInt(columnNumber),
                    }
                }
            }
            if (mode !== 'old') {
                const start = performance.now()
                const matches2 = /(at\s+)?(async\s+)?([^\s@]+)?(?:@|\s+\()?([^\s()]+):(\d+):(\d+)\)?/.exec(line)
                if (matches2) {
                    const url = newExtractLocation(matches2[4])
                    if (url) {
                        result.new = {
                            time: performance.now() - start,
                            file: url,
                            method: matches2[3] || '',
                            line: Number.parseInt(matches2[5]),
                            column: Number.parseInt(matches2[6]),
                        }
                    }
                }
            }
            acc.push(result)
            return acc
        }, [] as Result)
    }

    parser.addEventListener('submit', (event) => {
        event.preventDefault()
    })
    parseOld.addEventListener('click', (event) => {
        event.preventDefault()
        printResult(parse('old'))
    })
    parseNew.addEventListener('click', (event) => {
        event.preventDefault()
        printResult(parse('new'))
    })
    compare.addEventListener('click', (event) => {
        event.preventDefault()
        printResult(parse('compare'))
    })
    clearResults.addEventListener('click', (event) => {
        event.preventDefault()
        printResult([])
    })
    clear.addEventListener('click', (event) => {
        event.preventDefault()
        reset()
    })

    reset()
})
