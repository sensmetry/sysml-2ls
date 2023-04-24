/* eslint-disable @typescript-eslint/explicit-function-return-type */

let mock = undefined;

export function setMock(fn) {
    mock = fn;
}

export function activate(context) {
    mock.call(undefined, context);
}
