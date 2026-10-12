import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin "globals" de Vitest, Testing Library no limpia el DOM por si sola entre pruebas.
afterEach(() => cleanup());

// jsdom no implementa el desplazamiento de la ventana.
window.scrollTo = () => {};
