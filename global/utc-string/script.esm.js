const convertToUTCString = date => {
    return `${date.getUTCFullYear().toString().padStart(4, '0')}-` +
        `${(date.getUTCMonth() + 1).toString().padStart(2, '0')}-` +
        `${date.getUTCDate().toString().padStart(2, '0')}T` +
        `${date.getUTCHours().toString().padStart(2, '0')}:` +
        `${date.getUTCMinutes().toString().padStart(2, '0')}:` +
        `${date.getUTCSeconds().toString().padStart(2, '0')}`;
}

export { convertToUTCString };