'use strict';
const https = require('https');
const jsdom = require('jsdom').jsdom;

const categories = ['5★ Focus', '5★', '4★', '3★'];
const colors = ['Red', 'Green', 'Blue', 'Neutral'];
const data = {};

function normalize(name) {
    return name.trim().toLowerCase()
        .replace(/ \(male\)$/, ' (m)')
        .replace(/ \(female\)$/, ' (f)')
        .replace(/ \(mystery of the emblem\)$/, ' (young)')
        .replace(/ \(awakening\)$/, ' (adult)')
        .replace(/ \(rabbit\)$/, ' (spring festival)');
}

function readEvents(colorMap) {
    jsdom.env('https://fireemblemwiki.org/wiki/List_of_summoning_events_in_Fire_Emblem_Heroes', (err, window) => {
        if (err) {
            throw err;
        }

        const events = [];

        window.document.querySelectorAll('#mw-content-text > h3').forEach(header => {
            if (header.textContent !== 'Characters') {
                return;
            }

            // FIXME Parse / handle special probabilities

            let elem = header;
            let matches = null;
            while (!matches) {
                elem = elem.previousElementSibling;
                matches = elem.textContent.match(/ from (.*) on (.*) to (\d+)(.M UTC) on (.*)\./);
            }
            const startMatches = (matches[1] === 'launch' ? '7AM UTC' : matches[1]).match(/^(\d+)(.M UTC)$/);
            const startTime = new Date(`${matches[2]} ${startMatches[1]}:00 ${startMatches[2]}`);
            const endTime = new Date(`${matches[5]} ${matches[3]}:00 ${matches[4]}`);
            const name = elem.previousElementSibling.textContent;
            const names = categories.map(_ => []);
            var cat = -1;

            header.nextElementSibling.querySelectorAll('table table td').forEach(row => {
                const catIndex = categories.indexOf(row.textContent.trim());
                if (catIndex < 0) {
                    names[cat].push(normalize(row.textContent));
                } else {
                    cat = catIndex;
                }
            });

            events.push({
                name: name,
                start: startTime,
                end: endTime,
                names: names});
        });

        data.events = events;
        process();
    });
}

function readCharacters() {
    jsdom.env('https://feheroes.wiki/Hero_List', (err, window) => {
        if (err) {
            throw err;
        }

        const colorMap = {};
        window.document.querySelectorAll('table.wikitable tr').forEach((row, i) => {
            if (i) {
                const cols = row.children;
                const image = cols[4].querySelector('img').attributes.alt.value;
                const color = colors.map((c, i) => [c, i]).filter(([c, i]) => image.includes(c)).map(([c, i]) => i)[0];
                colorMap[cols[1].textContent.trim().toLowerCase()] = color;
            }
        });

        data.colorMap = colorMap;
        process();
    });
}

function parseFocusEvent(event) {
    const name = event.querySelector('th').textContent.trim().toLowerCase().replace(/^grand battle/, 'battling');
    const img = event.querySelector('img').attributes.src.value.replace(/thumb\//, '').replace(/\.png.*$/,'.png');
    return [name, img];
}

function readFocusLists() {
    const images = {};
    var pages = 0;

    function process_focus(err, window) {
        if (err) {
            throw err;
        }

        window.document.querySelectorAll('table.wikitable').forEach(event => {
            const [name, img] = parseFocusEvent(event);
            images[name] = img;
        });

        pages++;
        if (pages < 2) {
            return;
        }

        data.images = images;
        process();
    }

    jsdom.env('https://feheroes.wiki/Summoning_Focus_List', process_focus);
    jsdom.env('https://feheroes.wiki/Summoning_Focus_Archive', process_focus);
}

function process() {
    if (Object.keys(data).length < 3) {
        return;
    }

    var error = false;

    data.events.forEach(event => {
        event.count = event.names.map((names, i) => {
            const count = colors.map(_ => 0);
            names.forEach(name => {
                const color = data.colorMap[name];
                if (color === undefined) {
                    console.error(`couldn't find color of "${name}"`);
                    error = true;
                } else {
                    count[color] += 1;
                }
            });
            return count;
        });

        const lookupName = event.name.replace(/^.*: /, '').toLowerCase();
        const image = data.images[lookupName];
        if (image === undefined) {
            console.error(`couldn't find event named "${lookupName}"`);
            error = true;
        } else {
            event.img = image;
        }

        event.names = undefined;
    });

    if (error) {
        throw "missing data while parsing";
    }
    
    data.events.sort((a, b) => (Math.sign(b.end - a.end) << 2) + (Math.sign(b.start - a.start) << 1) + Math.sign(a.name.localeCompare(b.name)));

    console.log(JSON.stringify({
        rarities: categories,
        colors: colors,
        events: data.events}, null, 2));
}

readCharacters();
readEvents();
readFocusLists();
