// no need to use if we know an array is always going to have more than 2 elements

// adding an actual type check here would slow this down by a couple of million ops/s, and my coding is good enough to not need it
function uniquify(array) { // assert Array.isArray(array);
    switch (array.length) {
        case 0:
        case 1:
            return array;
        case 2: {
            const [ a, b ] = array;
            if (a === b)
                return [ a ];
            else
                return array;
        } break;
        default: {
            return Array.from(new Set(array));
        } break;
    }
}

export { uniquify };