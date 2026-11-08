/**
 * ContaPaso - Script Unificado Contable y de Interfaz (Vanilla JS sin CORS)
 * Compatible al 100% tanto abriendo con doble clic (file:///) como en servidores web y GitHub Pages.
 */

// ==========================================
// 1. FORMATEADORES Y UTILIDADES
// ==========================================
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$ 0';
  return '$ ' + Math.round(amount).toLocaleString('es-CO');
}

function formatUnits(qty) {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  return Number(qty).toLocaleString('es-CO');
}

// ==========================================
// 2. MOTOR DE CÁLCULO DE INVENTARIOS
// ==========================================

function validateOperationsStock(operations) {
  let currentStock = 0;
  const errors = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const qty = Number(op.cantidad) || 0;

    if (op.tipo === 'inicial' || op.tipo === 'compra') {
      currentStock += qty;
    } else if (op.tipo === 'venta') {
      if (qty > currentStock) {
        errors.push({
          index: i,
          operacion: op,
          solicitado: qty,
          disponible: currentStock,
          mensaje: `En la operación #${i + 1} (${op.detalle || 'Venta'}): Intentas vender ${qty} unidades pero solo hay ${currentStock} unidades disponibles en existencia.`
        });
      }
      currentStock = Math.max(0, currentStock - qty);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    finalStockUnits: currentStock
  };
}

function calculatePEPS(operations) {
  const capas = [];
  const kardexRows = [];
  let totalCostoVentas = 0;

  operations.forEach((op, index) => {
    const qty = Number(op.cantidad) || 0;
    const costoUnit = Number(op.costoUnitario) || 0;
    const row = {
      index: index + 1,
      fecha: op.fecha || `Op #${index + 1}`,
      detalle: op.detalle || (op.tipo === 'inicial' ? 'Inventario Inicial' : op.tipo === 'compra' ? 'Compra' : 'Venta'),
      tipo: op.tipo,
      entrada: { cantidad: 0, costoUnitario: 0, total: 0 },
      salida: { cantidad: 0, costoUnitario: 0, total: 0 },
      saldo: { cantidad: 0, total: 0, capas: [] },
      desgloseSalida: []
    };

    if (op.tipo === 'inicial' || op.tipo === 'compra') {
      const totalOperacion = qty * costoUnit;
      row.entrada = { cantidad: qty, costoUnitario: costoUnit, total: totalOperacion };
      capas.push({
        origen: op.detalle || (op.tipo === 'inicial' ? 'Inv. Inicial' : `Compra #${index + 1}`),
        costoUnitario: costoUnit,
        cantidadRestante: qty,
        cantidadOriginal: qty
      });
    } else if (op.tipo === 'venta') {
      let unidadesPorCubrir = qty;
      let costoTotalVenta = 0;
      const desglose = [];

      for (let c = 0; c < capas.length; c++) {
        const capa = capas[c];
        if (capa.cantidadRestante <= 0) continue;

        const tomar = Math.min(capa.cantidadRestante, unidadesPorCubrir);
        const subtotal = tomar * capa.costoUnitario;
        
        capa.cantidadRestante -= tomar;
        unidadesPorCubrir -= tomar;
        costoTotalVenta += subtotal;

        desglose.push({
          lote: capa.origen,
          cantidad: tomar,
          costoUnitario: capa.costoUnitario,
          subtotal
        });

        if (unidadesPorCubrir === 0) break;
      }

      totalCostoVentas += costoTotalVenta;
      const costoUnitarioPromedioVenta = qty > 0 ? costoTotalVenta / qty : 0;
      row.salida = {
        cantidad: qty,
        costoUnitario: costoUnitarioPromedioVenta,
        total: costoTotalVenta
      };
      row.desgloseSalida = desglose;
    }

    let saldoCantidad = 0;
    let saldoTotal = 0;
    const saldoCapas = [];

    capas.forEach(c => {
      if (c.cantidadRestante > 0) {
        saldoCantidad += c.cantidadRestante;
        const totalCapa = c.cantidadRestante * c.costoUnitario;
        saldoTotal += totalCapa;
        saldoCapas.push({
          lote: c.origen,
          cantidad: c.cantidadRestante,
          costoUnitario: c.costoUnitario,
          total: totalCapa
        });
      }
    });

    row.saldo = { cantidad: saldoCantidad, total: saldoTotal, capas: saldoCapas };
    kardexRows.push(row);
  });

  const finalSaldo = kardexRows.length > 0 ? kardexRows[kardexRows.length - 1].saldo : { cantidad: 0, total: 0, capas: [] };

  return {
    metodo: 'PEPS',
    nombreMetodo: 'Primeras en Entrar, Primeras en Salir (PEPS / FIFO)',
    kardex: kardexRows,
    costoVentasTotal: totalCostoVentas,
    inventarioFinalValor: finalSaldo.total,
    inventarioFinalUnidades: finalSaldo.cantidad,
    capasFinales: finalSaldo.capas
  };
}

function calculateUEPS(operations) {
  const capas = [];
  const kardexRows = [];
  let totalCostoVentas = 0;

  operations.forEach((op, index) => {
    const qty = Number(op.cantidad) || 0;
    const costoUnit = Number(op.costoUnitario) || 0;
    const row = {
      index: index + 1,
      fecha: op.fecha || `Op #${index + 1}`,
      detalle: op.detalle || (op.tipo === 'inicial' ? 'Inventario Inicial' : op.tipo === 'compra' ? 'Compra' : 'Venta'),
      tipo: op.tipo,
      entrada: { cantidad: 0, costoUnitario: 0, total: 0 },
      salida: { cantidad: 0, costoUnitario: 0, total: 0 },
      saldo: { cantidad: 0, total: 0, capas: [] },
      desgloseSalida: []
    };

    if (op.tipo === 'inicial' || op.tipo === 'compra') {
      const totalOperacion = qty * costoUnit;
      row.entrada = { cantidad: qty, costoUnitario: costoUnit, total: totalOperacion };
      capas.push({
        origen: op.detalle || (op.tipo === 'inicial' ? 'Inv. Inicial' : `Compra #${index + 1}`),
        costoUnitario: costoUnit,
        cantidadRestante: qty,
        cantidadOriginal: qty
      });
    } else if (op.tipo === 'venta') {
      let unidadesPorCubrir = qty;
      let costoTotalVenta = 0;
      const desglose = [];

      for (let c = capas.length - 1; c >= 0; c--) {
        const capa = capas[c];
        if (capa.cantidadRestante <= 0) continue;

        const tomar = Math.min(capa.cantidadRestante, unidadesPorCubrir);
        const subtotal = tomar * capa.costoUnitario;
        
        capa.cantidadRestante -= tomar;
        unidadesPorCubrir -= tomar;
        costoTotalVenta += subtotal;

        desglose.push({
          lote: capa.origen,
          cantidad: tomar,
          costoUnitario: capa.costoUnitario,
          subtotal
        });

        if (unidadesPorCubrir === 0) break;
      }

      totalCostoVentas += costoTotalVenta;
      const costoUnitarioPromedioVenta = qty > 0 ? costoTotalVenta / qty : 0;
      row.salida = {
        cantidad: qty,
        costoUnitario: costoUnitarioPromedioVenta,
        total: costoTotalVenta
      };
      row.desgloseSalida = desglose;
    }

    let saldoCantidad = 0;
    let saldoTotal = 0;
    const saldoCapas = [];

    capas.forEach(c => {
      if (c.cantidadRestante > 0) {
        saldoCantidad += c.cantidadRestante;
        const totalCapa = c.cantidadRestante * c.costoUnitario;
        saldoTotal += totalCapa;
        saldoCapas.push({
          lote: c.origen,
          cantidad: c.cantidadRestante,
          costoUnitario: c.costoUnitario,
          total: totalCapa
        });
      }
    });

    row.saldo = { cantidad: saldoCantidad, total: saldoTotal, capas: saldoCapas };
    kardexRows.push(row);
  });

  const finalSaldo = kardexRows.length > 0 ? kardexRows[kardexRows.length - 1].saldo : { cantidad: 0, total: 0, capas: [] };

  return {
    metodo: 'UEPS',
    nombreMetodo: 'Últimas en Entrar, Primeras en Salir (UEPS / LIFO)',
    kardex: kardexRows,
    costoVentasTotal: totalCostoVentas,
    inventarioFinalValor: finalSaldo.total,
    inventarioFinalUnidades: finalSaldo.cantidad,
    capasFinales: finalSaldo.capas
  };
}

function calculatePromedio(operations) {
  const kardexRows = [];
  let saldoCantidad = 0;
  let saldoTotal = 0;
  let costoUnitarioPonderado = 0;
  let totalCostoVentas = 0;

  operations.forEach((op, index) => {
    const qty = Number(op.cantidad) || 0;
    const costoUnit = Number(op.costoUnitario) || 0;
    const row = {
      index: index + 1,
      fecha: op.fecha || `Op #${index + 1}`,
      detalle: op.detalle || (op.tipo === 'inicial' ? 'Inventario Inicial' : op.tipo === 'compra' ? 'Compra' : 'Venta'),
      tipo: op.tipo,
      entrada: { cantidad: 0, costoUnitario: 0, total: 0 },
      salida: { cantidad: 0, costoUnitario: 0, total: 0 },
      saldo: { cantidad: 0, costoUnitario: 0, total: 0 },
      formulaExplicada: ''
    };

    if (op.tipo === 'inicial' || op.tipo === 'compra') {
      const totalOperacion = qty * costoUnit;
      row.entrada = { cantidad: qty, costoUnitario: costoUnit, total: totalOperacion };

      const saldoAnteriorTotal = saldoTotal;
      const saldoAnteriorCant = saldoCantidad;

      saldoCantidad += qty;
      saldoTotal += totalOperacion;
      costoUnitarioPonderado = saldoCantidad > 0 ? saldoTotal / saldoCantidad : 0;

      row.formulaExplicada = op.tipo === 'inicial'
        ? `Saldo inicial registrado: ${qty} unidades a ${formatCurrency(costoUnit)} = ${formatCurrency(totalOperacion)}.`
        : `Nuevo Costo Promedio = (${formatCurrency(saldoAnteriorTotal)} + ${formatCurrency(totalOperacion)}) / (${saldoAnteriorCant} + ${qty} unids) = ${formatCurrency(costoUnitarioPonderado)} por unidad.`;
    } else if (op.tipo === 'venta') {
      const costoTotalVenta = qty * costoUnitarioPonderado;
      totalCostoVentas += costoTotalVenta;

      row.salida = {
        cantidad: qty,
        costoUnitario: costoUnitarioPonderado,
        total: costoTotalVenta
      };

      saldoCantidad = Math.max(0, saldoCantidad - qty);
      saldoTotal = Math.max(0, saldoTotal - costoTotalVenta);

      row.formulaExplicada = `Salen ${qty} unidades al costo promedio vigente de ${formatCurrency(costoUnitarioPonderado)} = ${formatCurrency(costoTotalVenta)}.`;
    }

    row.saldo = {
      cantidad: saldoCantidad,
      costoUnitario: costoUnitarioPonderado,
      total: saldoTotal
    };

    kardexRows.push(row);
  });

  return {
    metodo: 'PROMEDIO',
    nombreMetodo: 'Promedio Ponderado Móvil (PP)',
    kardex: kardexRows,
    costoVentasTotal: totalCostoVentas,
    inventarioFinalValor: saldoTotal,
    inventarioFinalUnidades: saldoCantidad,
    costoUnitarioFinal: costoUnitarioPonderado
  };
}

function calculatePeriodico(operations, metodoValuacion = 'peps') {
  let invInicialUnidades = 0;
  let invInicialValor = 0;
  let comprasUnidades = 0;
  let comprasValor = 0;
  let ventasUnidades = 0;

  const todasCompras = [];

  operations.forEach((op) => {
    const qty = Number(op.cantidad) || 0;
    const costo = Number(op.costoUnitario) || 0;

    if (op.tipo === 'inicial') {
      invInicialUnidades += qty;
      invInicialValor += qty * costo;
      todasCompras.push({ tipo: 'inicial', cantidad: qty, costoUnitario: costo, total: qty * costo });
    } else if (op.tipo === 'compra') {
      comprasUnidades += qty;
      comprasValor += qty * costo;
      todasCompras.push({ tipo: 'compra', cantidad: qty, costoUnitario: costo, total: qty * costo });
    } else if (op.tipo === 'venta') {
      ventasUnidades += qty;
    }
  });

  const totalDisponibleUnidades = invInicialUnidades + comprasUnidades;
  const totalDisponibleValor = invInicialValor + comprasValor;
  const invFinalUnidades = Math.max(0, totalDisponibleUnidades - ventasUnidades);

  let invFinalValor = 0;
  let explicacionValuacion = '';

  if (metodoValuacion.toLowerCase() === 'peps') {
    let porCubrir = invFinalUnidades;
    for (let i = todasCompras.length - 1; i >= 0; i--) {
      const lote = todasCompras[i];
      const tomar = Math.min(lote.cantidad, porCubrir);
      invFinalValor += tomar * lote.costoUnitario;
      porCubrir -= tomar;
      if (porCubrir <= 0) break;
    }
    explicacionValuacion = `El inventario final de ${invFinalUnidades} unidades se valora con los precios de las compras más recientes (PEPS).`;
  } else if (metodoValuacion.toLowerCase() === 'ueps') {
    let porCubrir = invFinalUnidades;
    for (let i = 0; i < todasCompras.length; i++) {
      const lote = todasCompras[i];
      const tomar = Math.min(lote.cantidad, porCubrir);
      invFinalValor += tomar * lote.costoUnitario;
      porCubrir -= tomar;
      if (porCubrir <= 0) break;
    }
    explicacionValuacion = `El inventario final de ${invFinalUnidades} unidades se valora con los precios más antiguos / iniciales (UEPS).`;
  } else {
    const cpuGlobal = totalDisponibleUnidades > 0 ? totalDisponibleValor / totalDisponibleUnidades : 0;
    invFinalValor = invFinalUnidades * cpuGlobal;
    explicacionValuacion = `El inventario final de ${invFinalUnidades} unidades se valora al costo unitario medio global de ${formatCurrency(cpuGlobal)}.`;
  }

  const costoVentas = totalDisponibleValor - invFinalValor;

  return {
    metodo: 'PERIODICO',
    metodoValuacion: metodoValuacion.toUpperCase(),
    invInicial: { unidades: invInicialUnidades, valor: invInicialValor },
    comprasNetas: { unidades: comprasUnidades, valor: comprasValor },
    mercanciaDisponible: { unidades: totalDisponibleUnidades, valor: totalDisponibleValor },
    ventas: { unidades: ventasUnidades },
    invFinal: { unidades: invFinalUnidades, valor: invFinalValor },
    costoVentas: costoVentas,
    explicacion: explicacionValuacion
  };
}

function runComparativeAnalysis(operations) {
  const peps = calculatePEPS(operations);
  const ueps = calculateUEPS(operations);
  const promedio = calculatePromedio(operations);

  return {
    peps,
    ueps,
    promedio,
    comparativa: [
      {
        criterio: 'Costo de Ventas Total',
        peps: peps.costoVentasTotal,
        ueps: ueps.costoVentasTotal,
        promedio: promedio.costoVentasTotal,
        formato: 'moneda',
        explicacion: 'Monto que se descuenta de los ingresos en el Estado de Resultados.'
      },
      {
        criterio: 'Valor del Inventario Final',
        peps: peps.inventarioFinalValor,
        ueps: ueps.inventarioFinalValor,
        promedio: promedio.inventarioFinalValor,
        formato: 'moneda',
        explicacion: 'Valor que figura como activo corriente en el Balance General.'
      },
      {
        criterio: 'Unidades en Inventario Final',
        peps: peps.inventarioFinalUnidades,
        ueps: ueps.inventarioFinalUnidades,
        promedio: promedio.inventarioFinalUnidades,
        formato: 'unidades',
        explicacion: 'La cantidad física es idéntica en todos los métodos; solo cambia su valor monetario.'
      },
      {
        criterio: 'Impacto en la Utilidad Bruta',
        peps: 'Mayor utilidad contable',
        ueps: 'Menor utilidad contable',
        promedio: 'Utilidad equilibrada / intermedia',
        formato: 'texto',
        explicacion: 'En periodos inflacionarios (precios al alza).'
      },
      {
        criterio: 'Efecto en Impuestos de Renta',
        peps: 'Mayor pago de impuestos',
        ueps: 'Menor pago de impuestos',
        promedio: 'Efecto moderado',
        formato: 'texto',
        explicacion: 'A mayor utilidad contable, mayor base gravable.'
      },
      {
        criterio: 'Aceptación NIIF (NIC 2)',
        peps: 'Totalmente permitido ✅',
        ueps: 'Prohibido por NIIF ❌',
        promedio: 'Totalmente permitido ✅',
        formato: 'texto',
        explicacion: 'UEPS distorsiona el valor real del inventario en balance.'
      }
    ]
  };
}

// ==========================================
// 3. BANCO DE EJERCICIOS Y ALMACENAMIENTO
// ==========================================
const EJERCICIOS_PREDEFINIDOS = [
  {
    id: 'prd-oficial',
    titulo: 'Taller Oficial del PRD (Caso Estándar)',
    descripcion: 'Inventario inicial de 100 u @ $10.000, 2 compras y 2 ventas con cambio de precios en época de inflación.',
    metodoSugerido: 'peps',
    sistema: 'permanente',
    operaciones: [
      { id: 1, tipo: 'inicial', fecha: '01/Nov', detalle: 'Inventario Inicial', cantidad: 100, costoUnitario: 10000 },
      { id: 2, tipo: 'compra', fecha: '03/Nov', detalle: 'Compra Factura #01', cantidad: 50, costoUnitario: 12000 },
      { id: 3, tipo: 'venta', fecha: '05/Nov', detalle: 'Venta Factura #101', cantidad: 80, costoUnitario: 0 },
      { id: 4, tipo: 'compra', fecha: '08/Nov', detalle: 'Compra Factura #02', cantidad: 70, costoUnitario: 14000 },
      { id: 5, tipo: 'venta', fecha: '12/Nov', detalle: 'Venta Factura #102', cantidad: 90, costoUnitario: 0 }
    ]
  },
  {
    id: 'supermercado-retail',
    titulo: 'Tienda de Abarrotes (Alta Rotación)',
    descripcion: 'Ejercicio tipo parcial con 3 compras consecutivas y ventas parciales para practicar capas en PEPS y UEPS.',
    metodoSugerido: 'promedio',
    sistema: 'permanente',
    operaciones: [
      { id: 1, tipo: 'inicial', fecha: '01/Oct', detalle: 'Saldo en bodega', cantidad: 200, costoUnitario: 5000 },
      { id: 2, tipo: 'compra', fecha: '04/Oct', detalle: 'Compra Proveedor Central', cantidad: 150, costoUnitario: 5500 },
      { id: 3, tipo: 'venta', fecha: '07/Oct', detalle: 'Venta Mostrador', cantidad: 180, costoUnitario: 0 },
      { id: 4, tipo: 'compra', fecha: '11/Oct', detalle: 'Compra Reabastecimiento', cantidad: 100, costoUnitario: 6000 },
      { id: 5, tipo: 'venta', fecha: '15/Oct', detalle: 'Venta Fin de Semana', cantidad: 120, costoUnitario: 0 }
    ]
  },
  {
    id: 'parcial-universitario',
    titulo: 'Parcial Práctico: Desafío de Capas',
    descripcion: 'Lotes pequeños con precios variables diseñado para detectar errores comunes en el agotamiento de capas.',
    metodoSugerido: 'peps',
    sistema: 'permanente',
    operaciones: [
      { id: 1, tipo: 'inicial', fecha: '02/Sep', detalle: 'Inventario Inicial', cantidad: 60, costoUnitario: 25000 },
      { id: 2, tipo: 'compra', fecha: '05/Sep', detalle: 'Compra Lote A', cantidad: 40, costoUnitario: 28000 },
      { id: 3, tipo: 'venta', fecha: '09/Sep', detalle: 'Venta Cliente Mayorista', cantidad: 70, costoUnitario: 0 },
      { id: 4, tipo: 'compra', fecha: '14/Sep', detalle: 'Compra Lote B', cantidad: 50, costoUnitario: 31000 },
      { id: 5, tipo: 'venta', fecha: '20/Sep', detalle: 'Venta Pedido Escolar', cantidad: 55, costoUnitario: 0 }
    ]
  }
];

function obtenerEjercicios() {
  try {
    const data = localStorage.getItem('contapaso_ejercicios');
    const locales = data ? JSON.parse(data) : [];
    return [...locales, ...EJERCICIOS_PREDEFINIDOS];
  } catch {
    return EJERCICIOS_PREDEFINIDOS;
  }
}

// ==========================================
// 4. ESTADO GLOBAL DE LA APLICACIÓN
// ==========================================
window.AppState = {
  system: 'permanente',
  method: 'peps',
  isInflation: true,
  currentStep: 1,
  ultimoTitulo: 'Taller Oficial del PRD (Caso Estándar)',
  operations: [
    { id: 1, tipo: 'inicial', fecha: '01/Nov', detalle: 'Inventario Inicial', cantidad: 100, costoUnitario: 10000 },
    { id: 2, tipo: 'compra', fecha: '03/Nov', detalle: 'Compra Factura #01', cantidad: 50, costoUnitario: 12000 },
    { id: 3, tipo: 'venta', fecha: '05/Nov', detalle: 'Venta Factura #101', cantidad: 80, costoUnitario: 0 },
    { id: 4, tipo: 'compra', fecha: '08/Nov', detalle: 'Compra Factura #02', cantidad: 70, costoUnitario: 14000 },
    { id: 5, tipo: 'venta', fecha: '12/Nov', detalle: 'Venta Factura #102', cantidad: 90, costoUnitario: 0 }
  ]
};

// ==========================================
// 5. NAVEGACIÓN Y CONTROLADOR DE PANTALLAS
// ==========================================
window.goToStep = function(stepNumber) {
  window.AppState.currentStep = stepNumber;

  for (let i = 1; i <= 4; i++) {
    const sec = document.getElementById(`section-step-${i}`);
    if (sec) {
      if (i === stepNumber) {
        sec.classList.remove('hidden');
      } else {
        sec.classList.add('hidden');
      }
    }

    const navBtn = document.getElementById(`nav-step-${i}`);
    if (navBtn) {
      if (i === stepNumber) {
        navBtn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 text-white transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-cyan-300/40 flex items-center gap-1";
      } else {
        navBtn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-cyan-300 hover:bg-surface-container-high/80 transition-colors flex items-center gap-1";
      }
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (stepNumber === 1) {
    if (typeof window.actualizarBadgeHistorial === 'function') {
      window.actualizarBadgeHistorial();
    }
  } else if (stepNumber === 2) {
    window.renderOperationsTable();
    window.checkStockValidation();
  } else if (stepNumber === 3) {
    window.renderKardexView();
    if (typeof window.guardarEjercicioActualEnHistorial === 'function') {
      window.guardarEjercicioActualEnHistorial(false);
    }
  } else if (stepNumber === 4) {
    window.renderComparativeView();
    if (typeof window.guardarEjercicioActualEnHistorial === 'function') {
      window.guardarEjercicioActualEnHistorial(false);
    }
  }
};

window.selectSystem = function(system) {
  window.AppState.system = system;
  const cardPerm = document.getElementById('card-permanente');
  const cardPeri = document.getElementById('card-periodico');
  const checkPerm = document.getElementById('check-permanente');
  const checkPeri = document.getElementById('check-periodico');

  if (system === 'permanente') {
    if (cardPerm) cardPerm.className = "group relative rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 glass-panel border-2 border-cyan-400 neon-glow-blue hover:shadow-[0_0_35px_rgba(56,189,248,0.45)]";
    if (cardPeri) cardPeri.className = "group relative rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 glass-panel hover:bg-surface-container-high/80 border-2 border-slate-700/60 hover:border-slate-500 shadow-lg";

    if (checkPerm) {
      checkPerm.className = "w-6 h-6 rounded-full border-2 border-cyan-300 bg-gradient-to-tr from-blue-600 to-cyan-400 text-white flex items-center justify-center transition-all shadow-[0_0_10px_#38bdf8]";
      checkPerm.innerHTML = '<span class="material-symbols-outlined text-[15px] font-bold">check</span>';
    }
    if (checkPeri) {
      checkPeri.className = "w-6 h-6 rounded-full border-2 border-slate-600 bg-transparent flex items-center justify-center transition-all";
      checkPeri.innerHTML = '<span class="material-symbols-outlined text-[15px] font-bold hidden">check</span>';
    }
  } else {
    if (cardPeri) cardPeri.className = "group relative rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 glass-panel border-2 border-emerald-400 neon-glow-emerald hover:shadow-[0_0_35px_rgba(52,211,153,0.45)]";
    if (cardPerm) cardPerm.className = "group relative rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 glass-panel hover:bg-surface-container-high/80 border-2 border-slate-700/60 hover:border-slate-500 shadow-lg";

    if (checkPeri) {
      checkPeri.className = "w-6 h-6 rounded-full border-2 border-emerald-300 bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center transition-all shadow-[0_0_10px_#34d399]";
      checkPeri.innerHTML = '<span class="material-symbols-outlined text-[15px] font-bold">check</span>';
    }
    if (checkPerm) {
      checkPerm.className = "w-6 h-6 rounded-full border-2 border-slate-600 bg-transparent flex items-center justify-center transition-all";
      checkPerm.innerHTML = '<span class="material-symbols-outlined text-[15px] font-bold hidden">check</span>';
    }
  }

  window.updateSummaryStep1();
};

window.selectMethod = function(method) {
  window.AppState.method = method;
  const methods = ['peps', 'ueps', 'promedio'];

  methods.forEach(m => {
    const card = document.getElementById(`btn-method-${m}`);
    if (!card) return;
    const check = card.querySelector('.check-icon');

    if (m === method) {
      if (m === 'peps') {
        card.className = "cursor-pointer rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 text-white border-2 border-cyan-300 neon-glow-blue transition-all duration-200 transform scale-[1.015]";
      } else if (m === 'ueps') {
        card.className = "cursor-pointer rounded-2xl p-4 bg-gradient-to-br from-purple-700 via-indigo-700 to-fuchsia-600 text-white border-2 border-purple-300 shadow-[0_0_25px_rgba(167,139,250,0.4)] transition-all duration-200 transform scale-[1.015]";
      } else {
        card.className = "cursor-pointer rounded-2xl p-4 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 text-white border-2 border-emerald-300 neon-glow-emerald transition-all duration-200 transform scale-[1.015]";
      }
      if (check) {
        check.className = "w-5 h-5 rounded-full bg-white text-slate-900 flex items-center justify-center text-xs font-bold check-icon shadow opacity-100";
        check.innerText = "✓";
      }
    } else {
      card.className = "cursor-pointer rounded-2xl p-4 bg-surface-container/90 hover:bg-surface-container-high text-on-surface-variant border-2 border-slate-700/60 hover:border-slate-500 transition-all duration-200";
      if (check) {
        check.className = "w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-xs check-icon opacity-0";
      }
    }
  });

  window.updateSummaryStep1();
};

window.updateSummaryStep1 = function() {
  const sysEl = document.getElementById('summary-system-text');
  const methEl = document.getElementById('summary-method-text');
  const colEl = document.getElementById('summary-columns-text');

  if (sysEl) {
    if (window.AppState.system === 'permanente') {
      sysEl.innerHTML = '<span class="material-symbols-outlined text-[15px] text-cyan-300">table_chart_view</span> Kardex Permanente';
      if (colEl) colEl.innerText = "Entradas • Salidas • Existencias";
    } else {
      sysEl.innerHTML = '<span class="material-symbols-outlined text-[15px] text-emerald-300">inventory_2</span> Inventario Periódico';
      if (colEl) colEl.innerText = "Inv. Inicial • Compras • Físico Final";
    }
  }

  if (methEl) {
    const methodNames = {
      peps: 'PEPS (Primeras en salir)',
      ueps: 'UEPS (Últimas en salir)',
      promedio: 'Promedio Ponderado'
    };
    methEl.innerHTML = `<span class="material-symbols-outlined text-[15px] text-emerald-300">check_circle</span> ${methodNames[window.AppState.method]}`;
  }
};

// ==========================================
// 6. OPERACIONES (PASO 2)
// ==========================================
window.renderOperationsTable = function() {
  const tbody = document.getElementById('operations-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  window.AppState.operations.forEach((op, index) => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800 hover:bg-surface-container-high/40 transition-colors text-xs font-mono";

    const subtotal = op.tipo !== 'venta' ? (op.cantidad * op.costoUnitario) : '-';

    tr.innerHTML = `
      <td class="p-3 text-center text-slate-400 font-bold">${index + 1}</td>
      <td class="p-3">
        <select onchange="updateOpType(${index}, this.value)" class="bg-surface-container-lowest border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none">
          <option value="inicial" ${op.tipo === 'inicial' ? 'selected' : ''}>Inv. Inicial</option>
          <option value="compra" ${op.tipo === 'compra' ? 'selected' : ''}>Compra</option>
          <option value="venta" ${op.tipo === 'venta' ? 'selected' : ''}>Venta</option>
        </select>
      </td>
      <td class="p-3">
        <input type="text" value="${op.fecha || ''}" onchange="updateOpField(${index}, 'fecha', this.value)" class="w-20 bg-surface-container-lowest border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none" placeholder="01/Nov">
      </td>
      <td class="p-3">
        <input type="text" value="${op.detalle || ''}" onchange="updateOpField(${index}, 'detalle', this.value)" class="w-full min-w-[140px] bg-surface-container-lowest border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none" placeholder="Detalle...">
      </td>
      <td class="p-3 text-right">
        <input type="number" min="1" value="${op.cantidad || ''}" oninput="updateOpField(${index}, 'cantidad', this.value)" class="w-24 text-right bg-surface-container-lowest border border-slate-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-bold focus:border-cyan-400 focus:outline-none">
      </td>
      <td class="p-3 text-right">
        ${op.tipo !== 'venta' ? `
          <input type="number" min="0" step="100" value="${op.costoUnitario || ''}" oninput="updateOpField(${index}, 'costoUnitario', this.value)" class="w-28 text-right bg-surface-container-lowest border border-slate-700 rounded-lg px-2 py-1 text-xs text-emerald-300 font-bold focus:border-cyan-400 focus:outline-none">
        ` : `
          <span class="text-slate-500 italic text-[11px]">(Se calcula en Kardex)</span>
        `}
      </td>
      <td class="p-3 text-right font-bold text-white">
        ${typeof subtotal === 'number' ? formatCurrency(subtotal) : '<span class="text-slate-500">--</span>'}
      </td>
      <td class="p-3 text-center">
        <button onclick="removeOperation(${index})" class="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-colors" title="Eliminar fila">
          <span class="material-symbols-outlined text-[17px]">delete</span>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  window.updateOperationsSummaryBar();
};

window.updateOpType = function(index, newType) {
  window.AppState.operations[index].tipo = newType;
  if (newType === 'venta') {
    window.AppState.operations[index].costoUnitario = 0;
  } else if (!window.AppState.operations[index].costoUnitario) {
    window.AppState.operations[index].costoUnitario = 10000;
  }
  window.renderOperationsTable();
  window.checkStockValidation();
};

window.updateOpField = function(index, field, value) {
  if (field === 'cantidad' || field === 'costoUnitario') {
    window.AppState.operations[index][field] = Number(value) || 0;
  } else {
    window.AppState.operations[index][field] = value;
  }
  window.updateOperationsSummaryBar();
  window.checkStockValidation();
};

window.addOperation = function(tipo) {
  const nextId = window.AppState.operations.length + 1;
  const isVenta = tipo === 'venta';
  window.AppState.operations.push({
    id: nextId,
    tipo: tipo,
    fecha: `Día ${nextId}`,
    detalle: isVenta ? `Venta #${nextId}` : `Compra #${nextId}`,
    cantidad: 50,
    costoUnitario: isVenta ? 0 : 12000
  });

  window.renderOperationsTable();
  window.checkStockValidation();
};

window.removeOperation = function(index) {
  if (window.AppState.operations.length <= 1) {
    alert("El ejercicio debe tener al menos una operación.");
    return;
  }
  window.AppState.operations.splice(index, 1);
  window.renderOperationsTable();
  window.checkStockValidation();
};

window.clearOperations = function() {
  if (confirm("¿Estás segura de vaciar la tabla de operaciones?")) {
    window.AppState.operations = [
      { id: 1, tipo: 'inicial', fecha: '01/Nov', detalle: 'Inventario Inicial', cantidad: 100, costoUnitario: 10000 }
    ];
    window.renderOperationsTable();
    window.checkStockValidation();
  }
};

window.loadPRDExample = function() {
  window.AppState.ultimoTitulo = 'Taller Oficial del PRD (Caso Estándar)';
  window.AppState.operations = [
    { id: 1, tipo: 'inicial', fecha: '01/Nov', detalle: 'Inventario Inicial', cantidad: 100, costoUnitario: 10000 },
    { id: 2, tipo: 'compra', fecha: '03/Nov', detalle: 'Compra Factura #01', cantidad: 50, costoUnitario: 12000 },
    { id: 3, tipo: 'venta', fecha: '05/Nov', detalle: 'Venta Factura #101', cantidad: 80, costoUnitario: 0 },
    { id: 4, tipo: 'compra', fecha: '08/Nov', detalle: 'Compra Factura #02', cantidad: 70, costoUnitario: 14000 },
    { id: 5, tipo: 'venta', fecha: '12/Nov', detalle: 'Venta Factura #102', cantidad: 90, costoUnitario: 0 }
  ];
  window.renderOperationsTable();
  window.checkStockValidation();
};

window.checkStockValidation = function() {
  const validation = validateOperationsStock(window.AppState.operations);
  const alertBox = document.getElementById('stock-warning-banner');
  const alertText = document.getElementById('stock-warning-text');
  const btnCalculate = document.getElementById('btn-continue-to-kardex');

  if (!validation.isValid) {
    if (alertBox && alertText) {
      alertBox.classList.remove('hidden');
      alertText.innerText = validation.errors[0].mensaje;
    }
    if (btnCalculate) {
      btnCalculate.disabled = true;
      btnCalculate.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (alertBox) alertBox.classList.add('hidden');
    if (btnCalculate) {
      btnCalculate.disabled = false;
      btnCalculate.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
  return validation.isValid;
};

window.updateOperationsSummaryBar = function() {
  let entradas = 0;
  let salidas = 0;
  let valorEntradas = 0;

  window.AppState.operations.forEach(op => {
    const q = Number(op.cantidad) || 0;
    const c = Number(op.costoUnitario) || 0;
    if (op.tipo === 'inicial' || op.tipo === 'compra') {
      entradas += q;
      valorEntradas += q * c;
    } else if (op.tipo === 'venta') {
      salidas += q;
    }
  });

  const saldo = Math.max(0, entradas - salidas);

  const elEntradas = document.getElementById('ops-total-entradas');
  const elSalidas = document.getElementById('ops-total-salidas');
  const elSaldo = document.getElementById('ops-total-saldo');
  const elValor = document.getElementById('ops-total-valor-compras');

  if (elEntradas) elEntradas.innerText = formatUnits(entradas);
  if (elSalidas) elSalidas.innerText = formatUnits(salidas);
  if (elSaldo) elSaldo.innerText = formatUnits(saldo);
  if (elValor) elValor.innerText = formatCurrency(valorEntradas);
};

// ==========================================
// 7. KARDEX PASO A PASO (PASO 3)
// ==========================================
window.renderKardexView = function() {
  const isPeriodico = window.AppState.system === 'periodico';
  const secPermanente = document.getElementById('kardex-permanente-container');
  const secPeriodico = document.getElementById('kardex-periodico-container');

  ['peps', 'ueps', 'promedio'].forEach(m => {
    const btn = document.getElementById(`kardex-tab-${m}`);
    if (btn) {
      if (m === window.AppState.method) {
        btn.className = "px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30";
      } else {
        btn.className = "px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors";
      }
    }
  });

  if (isPeriodico) {
    if (secPermanente) secPermanente.classList.add('hidden');
    if (secPeriodico) secPeriodico.classList.remove('hidden');
    renderPeriodicoDetails();
  } else {
    if (secPeriodico) secPeriodico.classList.add('hidden');
    if (secPermanente) secPermanente.classList.remove('hidden');
    renderPermanenteDetails();
  }
};

function renderPermanenteDetails() {
  let result;
  if (window.AppState.method === 'peps') {
    result = calculatePEPS(window.AppState.operations);
  } else if (window.AppState.method === 'ueps') {
    result = calculateUEPS(window.AppState.operations);
  } else {
    result = calculatePromedio(window.AppState.operations);
  }

  const elCV = document.getElementById('kpi-costo-ventas');
  const elIF = document.getElementById('kpi-inventario-final');
  const elUnids = document.getElementById('kpi-unidades-finales');
  const elCuadre = document.getElementById('kpi-mercancia-disponible');

  if (elCV) elCV.innerText = formatCurrency(result.costoVentasTotal);
  if (elIF) elIF.innerText = formatCurrency(result.inventarioFinalValor);
  if (elUnids) elUnids.innerText = formatUnits(result.inventarioFinalUnidades) + ' u';
  if (elCuadre) elCuadre.innerText = formatCurrency(result.costoVentasTotal + result.inventarioFinalValor);

  const tbody = document.getElementById('kardex-tbody');
  if (tbody) {
    tbody.innerHTML = '';

    result.kardex.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-slate-800/80 hover:bg-surface-container-high/40 transition-colors font-mono text-[12px]";

      const esEntrada = row.tipo === 'inicial' || row.tipo === 'compra';

      tr.innerHTML = `
        <td class="p-3 text-center text-slate-400 font-bold">${row.fecha}</td>
        <td class="p-3 font-sans font-semibold text-white">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${esEntrada ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
            ${row.detalle}
          </div>
        </td>
        <td class="p-3 text-right ${row.entrada.cantidad > 0 ? 'text-emerald-300 font-bold' : 'text-slate-600'}">
          ${row.entrada.cantidad > 0 ? formatUnits(row.entrada.cantidad) : '-'}
        </td>
        <td class="p-3 text-right text-slate-300">
          ${row.entrada.costoUnitario > 0 ? formatCurrency(row.entrada.costoUnitario) : '-'}
        </td>
        <td class="p-3 text-right text-emerald-300 font-bold">
          ${row.entrada.total > 0 ? formatCurrency(row.entrada.total) : '-'}
        </td>
        <td class="p-3 text-right ${row.salida.cantidad > 0 ? 'text-rose-300 font-bold' : 'text-slate-600'}">
          ${row.salida.cantidad > 0 ? formatUnits(row.salida.cantidad) : '-'}
        </td>
        <td class="p-3 text-right text-slate-300">
          ${row.salida.costoUnitario > 0 ? formatCurrency(row.salida.costoUnitario) : '-'}
        </td>
        <td class="p-3 text-right text-rose-300 font-bold">
          ${row.salida.total > 0 ? formatCurrency(row.salida.total) : '-'}
        </td>
        <td class="p-3 text-right font-extrabold text-cyan-300 bg-cyan-950/20">
          ${formatUnits(row.saldo.cantidad)}
        </td>
        <td class="p-3 text-right font-bold text-white bg-cyan-950/20">
          ${formatCurrency(row.saldo.total)}
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  const stepsContainer = document.getElementById('pedagogical-steps-container');
  if (stepsContainer) {
    stepsContainer.innerHTML = '';
    const ventas = result.kardex.filter(r => r.tipo === 'venta');

    if (ventas.length === 0) {
      stepsContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-surface-container-low text-center text-xs text-slate-400">
          Aún no has registrado ventas. Agrega una venta en el Paso 2 para ver de qué lote se descargan las unidades.
        </div>
      `;
    } else {
      ventas.forEach((v, idx) => {
        const card = document.createElement('div');
        card.className = "rounded-xl p-4 bg-surface-container-low/90 border border-slate-700/80 shadow-md flex flex-col gap-3";

        let desgloseHTML = '';

        if (window.AppState.method === 'promedio') {
          desgloseHTML = `
            <div class="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span class="text-emerald-300 font-bold">Explicación del Promedio Móvil:</span>
              <p class="text-slate-300 mt-1">${v.formulaExplicada}</p>
            </div>
          `;
        } else {
          desgloseHTML = `
            <div class="flex flex-col gap-2">
              <span class="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Desglose lote por lote (${window.AppState.method.toUpperCase()}):
              </span>
              <div class="space-y-1.5 font-mono text-xs">
                ${v.desgloseSalida.map(item => `
                  <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span class="text-slate-300">📦 ${item.lote}:</span>
                    <span class="text-cyan-200 font-semibold">${item.cantidad} unids × ${formatCurrency(item.costoUnitario)}</span>
                    <span class="text-emerald-300 font-bold">= ${formatCurrency(item.subtotal)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        let saldoCapasHTML = '';
        if (window.AppState.method !== 'promedio' && v.saldo.capas) {
          saldoCapasHTML = `
            <div class="pt-2 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span class="text-slate-400">Bodega tras esta venta:</span>
              <div class="flex items-center gap-2 font-mono">
                ${v.saldo.capas.map(c => `<span class="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[11px]">${c.cantidad} u @ ${formatCurrency(c.costoUnitario)}</span>`).join(' + ')}
              </div>
            </div>
          `;
        }

        card.innerHTML = `
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center justify-center font-mono">${idx + 1}</span>
              <span class="font-bold text-sm text-white">${v.detalle} (${v.fecha})</span>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-400">Costo asignado:</span>
              <span class="ml-1.5 font-bold text-rose-300 text-sm font-mono">${formatCurrency(v.salida.total)}</span>
            </div>
          </div>
          ${desgloseHTML}
          ${saldoCapasHTML}
        `;

        stepsContainer.appendChild(card);
      });
    }
  }
}

function renderPeriodicoDetails() {
  const result = calculatePeriodico(window.AppState.operations, window.AppState.method);

  const elII = document.getElementById('periodico-ii');
  const elCompras = document.getElementById('periodico-compras');
  const elDisp = document.getElementById('periodico-disponible');
  const elIF = document.getElementById('periodico-if');
  const elCV = document.getElementById('periodico-cv');
  const elExplicacion = document.getElementById('periodico-explicacion');

  if (elII) elII.innerText = `${formatCurrency(result.invInicial.valor)} (${result.invInicial.unidades} u)`;
  if (elCompras) elCompras.innerText = `${formatCurrency(result.comprasNetas.valor)} (${result.comprasNetas.unidades} u)`;
  if (elDisp) elDisp.innerText = `${formatCurrency(result.mercanciaDisponible.valor)} (${result.mercanciaDisponible.unidades} u)`;
  if (elIF) elIF.innerText = `${formatCurrency(result.invFinal.valor)} (${result.invFinal.unidades} u)`;
  if (elCV) elCV.innerText = formatCurrency(result.costoVentas);
  if (elExplicacion) elExplicacion.innerText = result.explicacion;

  const elKpiCV = document.getElementById('kpi-costo-ventas');
  const elKpiIF = document.getElementById('kpi-inventario-final');
  const elKpiUnids = document.getElementById('kpi-unidades-finales');
  const elKpiCuadre = document.getElementById('kpi-mercancia-disponible');

  if (elKpiCV) elKpiCV.innerText = formatCurrency(result.costoVentas);
  if (elKpiIF) elKpiIF.innerText = formatCurrency(result.invFinal.valor);
  if (elKpiUnids) elKpiUnids.innerText = formatUnits(result.invFinal.unidades) + ' u';
  if (elKpiCuadre) elKpiCuadre.innerText = formatCurrency(result.mercanciaDisponible.valor);
}

window.switchKardexMethod = function(newMethod) {
  window.AppState.method = newMethod;
  window.renderKardexView();
  if (typeof window.guardarEjercicioActualEnHistorial === 'function') {
    window.guardarEjercicioActualEnHistorial(false);
  }
};

// ==========================================
// 8. ANÁLISIS COMPARATIVO (PASO 4)
// ==========================================
window.renderComparativeView = function() {
  const analysis = runComparativeAnalysis(window.AppState.operations);
  const tbody = document.getElementById('comparative-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  analysis.comparativa.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-800 hover:bg-surface-container-high/40 transition-colors text-xs";

    let valPEPS = item.peps;
    let valUEPS = item.ueps;
    let valProm = item.promedio;

    if (item.formato === 'moneda') {
      valPEPS = `<span class="font-bold text-white font-mono">${formatCurrency(item.peps)}</span>`;
      valUEPS = `<span class="font-bold text-white font-mono">${formatCurrency(item.ueps)}</span>`;
      valProm = `<span class="font-bold text-white font-mono">${formatCurrency(item.promedio)}</span>`;

      if (item.criterio.includes('Costo de Ventas')) {
        valPEPS += ' <span class="text-[10px] text-emerald-400 font-bold block">(Menor Costo)</span>';
        valUEPS += ' <span class="text-[10px] text-amber-400 font-bold block">(Mayor Costo)</span>';
      } else if (item.criterio.includes('Inventario Final')) {
        valPEPS += ' <span class="text-[10px] text-cyan-400 font-bold block">(Mayor Valor)</span>';
        valUEPS += ' <span class="text-[10px] text-purple-400 font-bold block">(Menor Valor)</span>';
      }
    } else if (item.formato === 'unidades') {
      valPEPS = `<span class="font-mono text-cyan-300 font-bold">${formatUnits(item.peps)} unids</span>`;
      valUEPS = `<span class="font-mono text-cyan-300 font-bold">${formatUnits(item.ueps)} unids</span>`;
      valProm = `<span class="font-mono text-cyan-300 font-bold">${formatUnits(item.promedio)} unids</span>`;
    }

    tr.innerHTML = `
      <td class="p-4 font-semibold text-white">
        <div class="font-bold">${item.criterio}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${item.explicacion}</div>
      </td>
      <td class="p-4 text-center bg-blue-950/20 border-x border-slate-800">${valPEPS}</td>
      <td class="p-4 text-center bg-purple-950/20 border-r border-slate-800">${valUEPS}</td>
      <td class="p-4 text-center bg-emerald-950/20">${valProm}</td>
    `;

    tbody.appendChild(tr);
  });
};

// ==========================================
// 9. BANCO DE TALLERES
// ==========================================
window.openExerciseBankModal = function() {
  const modal = document.getElementById('exercise-bank-modal');
  if (modal) modal.classList.remove('hidden');
  window.renderExerciseBankList();
};

window.closeExerciseBankModal = function() {
  const modal = document.getElementById('exercise-bank-modal');
  if (modal) modal.classList.add('hidden');
};

window.renderExerciseBankList = function() {
  const container = document.getElementById('exercise-bank-list');
  if (!container) return;

  const exercises = obtenerEjercicios();
  container.innerHTML = '';

  exercises.forEach((ex) => {
    const card = document.createElement('div');
    card.className = "p-4 rounded-xl bg-surface-container-low border border-slate-700/80 hover:border-cyan-400/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3";

    card.innerHTML = `
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-white">${ex.titulo}</span>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold uppercase">${ex.metodoSugerido || 'KARDEX'}</span>
        </div>
        <p class="text-xs text-slate-300">${ex.descripcion}</p>
        <span class="text-[11px] text-slate-400">${ex.operaciones.length} operaciones registradas</span>
      </div>
      <button onclick="loadExerciseFromBank('${ex.id}')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shrink-0 shadow-md active:scale-95 transition-all">
        Cargar Taller
      </button>
    `;

    container.appendChild(card);
  });
};

window.loadExerciseFromBank = function(exerciseId) {
  const exercises = obtenerEjercicios();
  const selected = exercises.find(e => e.id === exerciseId);
  if (!selected) return;

  window.AppState.operations = JSON.parse(JSON.stringify(selected.operaciones));
  if (selected.metodoSugerido) window.AppState.method = selected.metodoSugerido;
  if (selected.sistema) window.AppState.system = selected.sistema;
  window.AppState.ultimoTitulo = selected.titulo || 'Taller del Banco de Ejercicios';

  window.closeExerciseBankModal();
  window.selectSystem(window.AppState.system);
  window.selectMethod(window.AppState.method);
  window.goToStep(2);
};

// ==========================================
// 10. GENERADOR DE EJERCICIOS Y TUTOR DE PRÁCTICA
// ==========================================
const SECTORES_EJEMPLOS = [
  { id: 'supermercado', nombre: 'Abarrotes & Supermercado', item: 'Bultos de Café Gourmet', basePrecio: 15000 },
  { id: 'farmacia', nombre: 'Farmacia & Medicinas', item: 'Cajas de Vitaminas C 1000mg', basePrecio: 12000 },
  { id: 'tecnologia', nombre: 'Tecnología & Accesorios', item: 'Auriculares Bluetooth Pro', basePrecio: 45000 },
  { id: 'ropa', nombre: 'Boutique & Ropa', item: 'Camisetas Algodón Pima', basePrecio: 28000 },
  { id: 'ferreteria', nombre: 'Ferretería & Construcción', item: 'Galones de Pintura Tipo 1', basePrecio: 35000 }
];

window.ejercicioGeneradoActual = null;

window.generarNuevoEjercicio = function(nivel = 'intermedio', sectorId = 'aleatorio') {
  let sector = SECTORES_EJEMPLOS.find(s => s.id === sectorId);
  if (!sector || sectorId === 'aleatorio') {
    sector = SECTORES_EJEMPLOS[Math.floor(Math.random() * SECTORES_EJEMPLOS.length)];
  }

  const basePrice = sector.basePrecio;
  const operaciones = [];
  let currentStock = 0;
  let opIndex = 1;

  // 1. Inventario Inicial
  const cantInicial = nivel === 'basico' ? 50 : nivel === 'intermedio' ? 100 : 120;
  operaciones.push({
    id: opIndex++,
    tipo: 'inicial',
    fecha: '01/Nov',
    detalle: `Inv. Inicial: ${sector.item}`,
    cantidad: cantInicial,
    costoUnitario: basePrice
  });
  currentStock += cantInicial;

  // 2. Compra 1 (generalmente con precio superior por inflación)
  const inflacion1 = Math.round(basePrice * 1.15 / 1000) * 1000;
  const cantCompra1 = nivel === 'basico' ? 40 : 60;
  operaciones.push({
    id: opIndex++,
    tipo: 'compra',
    fecha: '04/Nov',
    detalle: 'Compra Factura #201',
    cantidad: cantCompra1,
    costoUnitario: inflacion1
  });
  currentStock += cantCompra1;

  // 3. Venta 1 (segura, nunca excede stock)
  const cantVenta1 = nivel === 'basico' ? 60 : 70;
  operaciones.push({
    id: opIndex++,
    tipo: 'venta',
    fecha: '08/Nov',
    detalle: 'Venta Factura #01',
    cantidad: cantVenta1,
    costoUnitario: 0
  });
  currentStock -= cantVenta1;

  if (nivel !== 'basico') {
    // 4. Compra 2
    const inflacion2 = Math.round(basePrice * 1.30 / 1000) * 1000;
    const cantCompra2 = nivel === 'avanzado' ? 80 : 50;
    operaciones.push({
      id: opIndex++,
      tipo: 'compra',
      fecha: '14/Nov',
      detalle: 'Compra Factura #202',
      cantidad: cantCompra2,
      costoUnitario: inflacion2
    });
    currentStock += cantCompra2;

    // 5. Venta 2
    const cantVenta2 = nivel === 'avanzado' ? 90 : 80;
    operaciones.push({
      id: opIndex++,
      tipo: 'venta',
      fecha: '19/Nov',
      detalle: 'Venta Factura #02',
      cantidad: cantVenta2,
      costoUnitario: 0
    });
    currentStock -= cantVenta2;
  }

  if (nivel === 'avanzado') {
    // 6. Compra 3
    const inflacion3 = Math.round(basePrice * 1.45 / 1000) * 1000;
    operaciones.push({
      id: opIndex++,
      tipo: 'compra',
      fecha: '24/Nov',
      detalle: 'Compra Factura #203',
      cantidad: 50,
      costoUnitario: inflacion3
    });
    currentStock += 50;

    // 7. Venta 3
    operaciones.push({
      id: opIndex++,
      tipo: 'venta',
      fecha: '28/Nov',
      detalle: 'Venta Factura #03',
      cantidad: 60,
      costoUnitario: 0
    });
    currentStock -= 60;
  }

  // Generar enunciado en prosa para que la estudiante lo copie o lea
  let enunciado = `TALLER PRÁCTICO DE INVENTARIOS\nEmpresa: "${sector.nombre}"\nArtículo: ${sector.item}\nNivel: ${nivel.toUpperCase()}\n\n`;
  enunciado += `La empresa solicita resolver la tarjeta de Kardex y determinar el Costo de Ventas y el Inventario Final con los siguientes movimientos del mes:\n\n`;

  operaciones.forEach((op, i) => {
    if (op.tipo === 'inicial') {
      enunciado += `${i + 1}. [${op.fecha}] Saldo inicial en bodega de ${op.cantidad} unidades a ${formatCurrency(op.costoUnitario)} cada una.\n`;
    } else if (op.tipo === 'compra') {
      enunciado += `${i + 1}. [${op.fecha}] Compra según ${op.detalle} de ${op.cantidad} unidades a ${formatCurrency(op.costoUnitario)} c/u.\n`;
    } else {
      enunciado += `${i + 1}. [${op.fecha}] Venta según ${op.detalle} de ${op.cantidad} unidades al cliente.\n`;
    }
  });

  enunciado += `\nConsignas a resolver:\n`;
  enunciado += `a) Elaborar el Kardex por el método PEPS y determinar el Costo de Ventas.\n`;
  enunciado += `b) Elaborar el Kardex por Promedio Ponderado Móvil.\n`;
  enunciado += `c) Comparar ambos métodos y explicar cuál genera mayor utilidad bruta.\n`;

  window.ejercicioGeneradoActual = {
    titulo: `Taller de ${sector.nombre} (${nivel.toUpperCase()})`,
    sector: sector.nombre,
    item: sector.item,
    nivel: nivel,
    enunciado: enunciado,
    operaciones: operaciones
  };

  // Actualizar la interfaz del modal
  const elEnunciado = document.getElementById('gen-enunciado-text');
  const elTitulo = document.getElementById('gen-taller-titulo');
  const elBadge = document.getElementById('gen-taller-badge');
  const btnCargar = document.getElementById('btn-cargar-taller-gen');

  if (elEnunciado) elEnunciado.value = enunciado;
  if (elTitulo) elTitulo.innerText = window.ejercicioGeneradoActual.titulo;
  if (elBadge) elBadge.innerText = `${operaciones.length} Operaciones • Nivel ${nivel.toUpperCase()}`;
  if (btnCargar) btnCargar.disabled = false;

  return window.ejercicioGeneradoActual;
};

window.cargarEjercicioGeneradoAlTaller = function() {
  if (!window.ejercicioGeneradoActual || !window.ejercicioGeneradoActual.operaciones) {
    alert("Primero genera un ejercicio.");
    return;
  }

  window.AppState.operations = JSON.parse(JSON.stringify(window.ejercicioGeneradoActual.operaciones));
  window.AppState.ultimoTitulo = window.ejercicioGeneradoActual.titulo || 'Taller Práctico Generado';
  window.closeGeneradorModal();
  window.goToStep(2);
};

window.copiarEnunciadoGenerado = function() {
  if (!window.ejercicioGeneradoActual) return;
  navigator.clipboard.writeText(window.ejercicioGeneradoActual.enunciado).then(() => {
    const btn = document.getElementById('btn-copiar-enunciado');
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">check</span> ¡Copiado!';
      setTimeout(() => btn.innerHTML = original, 2000);
    }
  });
};

window.openGeneradorModal = function() {
  const modal = document.getElementById('generador-ejercicios-modal');
  if (modal) modal.classList.remove('hidden');
  if (!window.ejercicioGeneradoActual) {
    window.generarNuevoEjercicio('intermedio', 'aleatorio');
  }
};

window.closeGeneradorModal = function() {
  const modal = document.getElementById('generador-ejercicios-modal');
  if (modal) modal.classList.add('hidden');
};

// ==========================================
// 11. HISTORIAL DE EJERCICIOS (SIN INICIO DE SESIÓN)
// ==========================================
const HISTORIAL_STORAGE_KEY = 'contapaso_historial_ejercicios';

function obtenerHistorial() {
  try {
    const raw = localStorage.getItem(HISTORIAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error al leer historial de localStorage:", e);
    return [];
  }
}

function guardarHistorialStorage(lista) {
  try {
    localStorage.setItem(HISTORIAL_STORAGE_KEY, JSON.stringify(lista));
    if (typeof window.actualizarBadgeHistorial === 'function') {
      window.actualizarBadgeHistorial();
    }
  } catch (e) {
    console.error("Error al guardar historial en localStorage:", e);
  }
}

window.actualizarBadgeHistorial = function() {
  const lista = obtenerHistorial();
  const badge = document.getElementById('history-badge-count');
  if (badge) {
    badge.innerText = lista.length;
    if (lista.length > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  const modalCount = document.getElementById('history-modal-count-badge');
  if (modalCount) {
    modalCount.innerText = `${lista.length} guardados`;
  }

  // Actualizar widget de historial en Paso 1 si existe
  const step1Subtitle = document.getElementById('step1-history-subtitle');
  const step1Recent = document.getElementById('step1-recent-history-list');
  if (step1Subtitle) {
    if (lista.length > 0) {
      step1Subtitle.innerText = `Tienes ${lista.length} ejercicio(s) guardado(s) listos para repasar`;
    } else {
      step1Subtitle.innerText = 'Aún no has resuelto ejercicios. Resuelve uno y quedará guardado aquí.';
    }
  }
  if (step1Recent) {
    if (lista.length > 0) {
      step1Recent.classList.remove('hidden');
      const ultimos = lista.slice(0, 2);
      step1Recent.innerHTML = `
        <span class="text-[10px] uppercase font-bold text-slate-400 mt-1">Últimos resueltos para revisar:</span>
        ${ultimos.map(ex => `
          <div class="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
            <div class="flex items-center gap-1.5 truncate max-w-[220px]">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span class="font-bold text-white truncate">${ex.titulo}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="font-mono text-[11px] text-cyan-300 font-bold">${formatCurrency(ex.resumen?.inventarioFinalValor || 0)}</span>
              <button onclick="cargarEjercicioDesdeHistorial('${ex.id}', 3)" class="px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/60 text-cyan-200 border border-cyan-400/30 text-[10px] font-bold transition-all">
                Revisar
              </button>
            </div>
          </div>
        `).join('')}
      `;
    } else {
      step1Recent.classList.add('hidden');
      step1Recent.innerHTML = '';
    }
  }
};

window.guardarEjercicioActualEnHistorial = function(manual = false) {
  if (!window.AppState.operations || window.AppState.operations.length === 0) return;

  // Calculamos los totales según el sistema y método actual
  let costoVentas = 0;
  let inventarioFinalValor = 0;
  let inventarioFinalUnidades = 0;
  let totalEntradas = 0;
  let totalSalidas = 0;

  window.AppState.operations.forEach(op => {
    const q = Number(op.cantidad) || 0;
    if (op.tipo === 'inicial' || op.tipo === 'compra') totalEntradas += q;
    else if (op.tipo === 'venta') totalSalidas += q;
  });

  if (window.AppState.system === 'periodico') {
    const res = calculatePeriodico(window.AppState.operations, window.AppState.method);
    costoVentas = res.costoVentas;
    inventarioFinalValor = res.invFinal.valor;
    inventarioFinalUnidades = res.invFinal.unidades;
  } else {
    let res;
    if (window.AppState.method === 'peps') res = calculatePEPS(window.AppState.operations);
    else if (window.AppState.method === 'ueps') res = calculateUEPS(window.AppState.operations);
    else res = calculatePromedio(window.AppState.operations);

    costoVentas = res.costoVentasTotal;
    inventarioFinalValor = res.inventarioFinalValor;
    inventarioFinalUnidades = res.inventarioFinalUnidades;
  }

  const opsStr = JSON.stringify(window.AppState.operations);
  const historial = obtenerHistorial();

  // Si el ejercicio más reciente es idéntico en operaciones, método y sistema
  const ultimo = historial[0];
  const esMismoEjercicio = ultimo &&
    JSON.stringify(ultimo.operaciones) === opsStr &&
    ultimo.metodo === window.AppState.method &&
    ultimo.sistema === window.AppState.system;

  const now = new Date();
  const fechaLegible = now.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (esMismoEjercicio) {
    ultimo.fechaISO = now.toISOString();
    ultimo.fechaFormateada = fechaLegible;
    ultimo.resumen = {
      costoVentas,
      inventarioFinalValor,
      inventarioFinalUnidades,
      totalEntradas,
      totalSalidas
    };
    guardarHistorialStorage(historial);
    if (typeof window.guardarHistorialFirestore === 'function') {
      window.guardarHistorialFirestore(ultimo);
    }
    if (manual) {
      window.mostrarToastNotificacion(window.isFirebaseReady ? "¡Taller actualizado en tu historial y en la nube!" : "¡Taller actualizado en tu historial local!");
    }
    return;
  }

  // Generar título
  let titulo = window.AppState.ultimoTitulo;
  if (!titulo) {
    const metodoNombre = window.AppState.method.toUpperCase();
    const cantOps = window.AppState.operations.length;
    titulo = `Taller ${metodoNombre} • ${cantOps} operaciones`;
  }

  const nuevoItem = {
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    titulo: titulo,
    fechaISO: now.toISOString(),
    fechaFormateada: fechaLegible,
    sistema: window.AppState.system,
    metodo: window.AppState.method,
    operaciones: JSON.parse(opsStr),
    resumen: {
      costoVentas,
      inventarioFinalValor,
      inventarioFinalUnidades,
      totalEntradas,
      totalSalidas
    }
  };

  historial.unshift(nuevoItem);
  if (historial.length > 50) historial.pop(); // Mantener los 50 más recientes

  guardarHistorialStorage(historial);
  if (typeof window.guardarHistorialFirestore === 'function') {
    window.guardarHistorialFirestore(nuevoItem);
  }

  if (manual) {
    window.mostrarToastNotificacion(window.isFirebaseReady ? "¡Taller guardado en tu historial y en la nube!" : "¡Taller guardado en tu historial local!");
  }
};

window.cargarEjercicioDesdeHistorial = function(id, targetStep = 3) {
  const historial = obtenerHistorial();
  const item = historial.find(h => h.id === id);
  if (!item) return;

  window.AppState.system = item.sistema || 'permanente';
  window.AppState.method = item.metodo || 'peps';
  window.AppState.operations = JSON.parse(JSON.stringify(item.operaciones));
  window.AppState.ultimoTitulo = item.titulo;

  window.selectSystem(window.AppState.system);
  window.selectMethod(window.AppState.method);
  window.renderOperationsTable();
  window.closeHistoryModal();

  window.goToStep(targetStep);
  window.mostrarToastNotificacion(`Revisando: "${item.titulo}"`);
};

window.eliminarEjercicioHistorial = function(id) {
  let historial = obtenerHistorial();
  historial = historial.filter(h => h.id !== id);
  guardarHistorialStorage(historial);
  window.renderHistoryModal();
  window.mostrarToastNotificacion("Ejercicio eliminado del historial");
};

window.limpiarTodoElHistorial = function() {
  const historial = obtenerHistorial();
  if (historial.length === 0) return;
  if (confirm("¿Estás segura de que deseas vaciar todo tu historial de ejercicios? Esta acción no se puede deshacer.")) {
    guardarHistorialStorage([]);
    window.renderHistoryModal();
    window.mostrarToastNotificacion("Historial vaciado correctamente");
  }
};

window.exportarHistorialJSON = function() {
  const historial = obtenerHistorial();
  if (historial.length === 0) {
    alert("No tienes ejercicios en tu historial para exportar.");
    return;
  }
  const blob = new Blob([JSON.stringify(historial, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contapaso_historial_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.mostrarToastNotificacion("Historial descargado en archivo JSON");
};

window.importarHistorialJSON = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (Array.isArray(data)) {
        const actual = obtenerHistorial();
        const idsExistentes = new Set(actual.map(a => a.id));
        const nuevos = data.filter(d => d && d.operaciones && !idsExistentes.has(d.id));
        const combinado = [...nuevos, ...actual].slice(0, 60);
        guardarHistorialStorage(combinado);
        window.renderHistoryModal();
        window.mostrarToastNotificacion(`¡Se importaron ${nuevos.length} ejercicios con éxito!`);
      } else {
        alert("El archivo no tiene el formato esperado de historial.");
      }
    } catch (err) {
      alert("Error al leer el archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

window.mostrarToastNotificacion = function(mensaje) {
  let toast = document.getElementById('contapaso-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'contapaso-toast';
    toast.className = "fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 border border-cyan-400 text-white text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(56,189,248,0.4)] backdrop-blur-xl transition-all duration-300 transform translate-y-20 opacity-0";
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
    <span class="text-cyan-200">${mensaje}</span>
  `;

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3200);
};

window.renderHistoryModal = function() {
  const container = document.getElementById('history-items-container');
  if (!container) return;

  const historial = obtenerHistorial();
  const filtroTexto = (document.getElementById('history-search-input')?.value || '').toLowerCase().trim();
  const filtroMetodo = (document.getElementById('history-method-filter')?.value || 'todos').toLowerCase();

  let filtrados = historial.filter(item => {
    if (filtroMetodo !== 'todos' && item.metodo !== filtroMetodo) return false;
    if (filtroTexto) {
      const matchTitulo = (item.titulo || '').toLowerCase().includes(filtroTexto);
      const matchMetodo = (item.metodo || '').toLowerCase().includes(filtroTexto);
      const matchSistema = (item.sistema || '').toLowerCase().includes(filtroTexto);
      return matchTitulo || matchMetodo || matchSistema;
    }
    return true;
  });

  if (filtrados.length === 0) {
    if (historial.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center flex flex-col items-center justify-center gap-3 bg-surface-container-low/60 rounded-2xl border border-slate-800">
          <div class="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <span class="material-symbols-outlined text-[36px]">history_toggle_off</span>
          </div>
          <h4 class="text-base font-bold text-white">Tu historial está vacío</h4>
          <p class="text-xs text-slate-400 max-w-md leading-relaxed">
            Cada vez que resuelvas un ejercicio de Kardex o generes un caso nuevo, se guardará aquí automáticamente en tu navegador, sin necesidad de crear cuenta ni iniciar sesión.
          </p>
          <div class="flex items-center gap-2 pt-2">
            <button onclick="closeHistoryModal(); loadPRDExample(); goToStep(3);" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold transition-all shadow-md active:scale-95">
              Cargar Ejercicio Oficial del PRD
            </button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-400 bg-surface-container-low/60 rounded-xl">
          No se encontraron ejercicios que coincidan con tu búsqueda.
        </div>
      `;
    }
    return;
  }

  container.innerHTML = '';

  filtrados.forEach((item) => {
    const card = document.createElement('div');
    card.className = "rounded-2xl p-4 bg-surface-container-low/90 border border-slate-700/80 hover:border-cyan-400/50 transition-all flex flex-col gap-3 shadow-md group";

    const metodoColor = item.metodo === 'peps'
      ? 'bg-blue-950/80 text-cyan-300 border-cyan-500/40'
      : item.metodo === 'ueps'
      ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';

    const metodoNombre = item.metodo === 'peps'
      ? 'PEPS'
      : item.metodo === 'ueps'
      ? 'UEPS'
      : 'Promedio';

    const sistemaNombre = item.sistema === 'periodico' ? 'Inv. Periódico' : 'Kardex Permanente';

    const cv = item.resumen?.costoVentas || 0;
    const ifVal = item.resumen?.inventarioFinalValor || 0;
    const ifUnids = item.resumen?.inventarioFinalUnidades || 0;
    const cantOps = item.operaciones?.length || 0;

    const opDetalleId = `ops-preview-${item.id}`;

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2.5 py-0.5 rounded-lg border text-[11px] font-bold font-mono uppercase ${metodoColor}">
            ${metodoNombre}
          </span>
          <span class="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700">
            ${sistemaNombre}
          </span>
          <h4 class="font-bold text-white text-sm tracking-tight">${item.titulo || 'Ejercicio de Kardex'}</h4>
        </div>
        <div class="flex items-center gap-2 text-xs text-slate-400">
          <span class="material-symbols-outlined text-[15px] text-slate-500">schedule</span>
          <span>${item.fechaFormateada || 'Reciente'}</span>
        </div>
      </div>

      <!-- Resumen de Métricas Clave -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <span class="text-[10px] text-rose-300 uppercase block font-sans font-bold">Costo de Ventas:</span>
          <span class="text-white font-bold">${formatCurrency(cv)}</span>
        </div>
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <span class="text-[10px] text-cyan-300 uppercase block font-sans font-bold">Inventario Final:</span>
          <span class="text-white font-bold">${formatCurrency(ifVal)}</span>
        </div>
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <span class="text-[10px] text-emerald-300 uppercase block font-sans font-bold">Unidades Finales:</span>
          <span class="text-white font-bold">${formatUnits(ifUnids)} u</span>
        </div>
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
          <span class="text-[10px] text-purple-300 uppercase block font-sans font-bold">Operaciones:</span>
          <span class="text-white font-bold">${cantOps} registros</span>
        </div>
      </div>

      <!-- Acordeón para ver detalle de operaciones -->
      <div>
        <button onclick="toggleOpsPreview('${opDetalleId}')" class="text-[11px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1 font-semibold transition-colors">
          <span class="material-symbols-outlined text-[14px]">expand_more</span>
          <span>Ver operaciones del ejercicio (${cantOps})</span>
        </button>
        <div id="${opDetalleId}" class="hidden mt-2 p-2.5 rounded-xl bg-black/40 border border-slate-800 text-[11px] font-mono space-y-1">
          ${item.operaciones.map((op, i) => `
            <div class="flex items-center justify-between text-slate-300">
              <span>#${i + 1} • <strong class="text-white">${op.tipo.toUpperCase()}</strong>: ${op.detalle || op.fecha}</span>
              <span class="text-cyan-300">${op.cantidad} u ${op.tipo !== 'venta' ? '@ ' + formatCurrency(op.costoUnitario) : ''}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Barra de Acciones para Revisar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <button onclick="eliminarEjercicioHistorial('${item.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1 transition-colors self-start sm:self-auto" title="Eliminar de mi historial">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span class="text-[11px]">Eliminar</span>
        </button>
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="cargarEjercicioDesdeHistorial('${item.id}', 2)" class="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1" title="Cargar y modificar las cantidades o precios">
            <span class="material-symbols-outlined text-[15px]">edit</span>
            <span>Editar Datos</span>
          </button>
          <button onclick="cargarEjercicioDesdeHistorial('${item.id}', 4)" class="px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 text-xs font-bold border border-purple-500/40 transition-colors flex items-center gap-1" title="Ver análisis comparativo multimétodo">
            <span class="material-symbols-outlined text-[15px]">compare_arrows</span>
            <span>Comparativa</span>
          </button>
          <button onclick="cargarEjercicioDesdeHistorial('${item.id}', 3)" class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all" title="Revisar el Kardex resuelto paso a paso">
            <span class="material-symbols-outlined text-[16px] text-amber-300">visibility</span>
            <span>Revisar Kardex</span>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
};

window.toggleOpsPreview = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden');
};

window.openHistoryModal = function() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.remove('hidden');
  window.renderHistoryModal();
};

window.closeHistoryModal = function() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.add('hidden');
};

// ==========================================
// 12. MODALES, TIPS Y PRESETS
// ==========================================
const tipData = {
  perecederos: {
    rec: "RECOMENDADO: PEPS",
    sub: "Alimentos, medicinas y retail",
    text: "En productos con fecha de vencimiento o rotación constante: los primeros lotes que entraron a la bodega son los primeros en salir, protegiendo el inventario final con las compras más frescas.",
    icon: "restaurant"
  },
  impuestos: {
    rec: "EFECTO FISCAL: UEPS",
    sub: "Cálculo en escenarios inflacionarios",
    text: "Al descargar las compras más recientes y costosas primero, el Costo de Ventas (CV) es más alto, lo cual reduce la utilidad contable y el impuesto a pagar.",
    icon: "trending_down"
  },
  grano: {
    rec: "IDEAL: PROMEDIO PONDERADO",
    sub: "Combustibles, químicos y commodities",
    text: "Para mercancías donde es imposible o innecesario rastrear qué saco o litro específico se vendió. Todo se mezcla en un costo unitario ponderado continuo.",
    icon: "balance"
  },
  parciales: {
    rec: "TIPS PARA EL EXAMEN",
    sub: "Reglas clave para talleres",
    text: "Si el examen no aclara el método y hay precios en aumento: PEPS da la mayor utilidad y mayor inventario final; UEPS da el mayor costo de venta y menor utilidad; Promedio da un resultado intermedio.",
    icon: "school"
  }
};

window.showTip = function(key) {
  const data = tipData[key];
  if (!data) return;

  ['perecederos', 'impuestos', 'grano', 'parciales'].forEach(p => {
    const pill = document.getElementById(`pill-${p}`);
    if (pill) {
      if (p === key) {
        pill.className = "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_12px_rgba(56,189,248,0.4)] border border-cyan-300/40";
      } else {
        pill.className = "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-surface-container-high/90 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500";
      }
    }
  });

  const b = document.getElementById('tip-recommended-badge');
  const s = document.getElementById('tip-subtag');
  const t = document.getElementById('tip-text');
  const i = document.getElementById('tip-icon');
  if (b) b.innerText = data.rec;
  if (s) s.innerText = data.sub;
  if (t) t.innerText = data.text;
  if (i) i.innerHTML = `<span class="material-symbols-outlined text-[20px]">${data.icon}</span>`;
};

window.toggleScenario = function() {
  window.AppState.isInflation = !window.AppState.isInflation;
  const pill = document.getElementById('scenario-pill');
  if (pill) {
    if (window.AppState.isInflation) {
      pill.innerHTML = '<span class="material-symbols-outlined text-[15px] text-emerald-400">trending_up</span> Inflación (Precios al alza)';
      pill.className = "font-bold text-emerald-300 flex items-center gap-1 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]";
    } else {
      pill.innerHTML = '<span class="material-symbols-outlined text-[15px] text-purple-400">trending_flat</span> Precios estables';
      pill.className = "font-bold text-purple-300 flex items-center gap-1 drop-shadow-[0_0_8px_rgba(167,139,250,0.4)]";
    }
  }
};

window.applyPreset = function(preset) {
  if (preset === 'prd') {
    window.selectSystem('permanente');
    window.selectMethod('peps');
    window.showTip('parciales');
  } else if (preset === 'retail') {
    window.selectSystem('permanente');
    window.selectMethod('promedio');
    window.showTip('perecederos');
  }
};

window.openFaqModal = function() {
  const m = document.getElementById('faq-modal');
  if (m) m.classList.remove('hidden');
};

window.closeFaqModal = function() {
  const m = document.getElementById('faq-modal');
  if (m) m.classList.add('hidden');
};

window.toggleFaq = function(num) {
  const ans = document.getElementById(`faq-ans-${num}`);
  const chevron = document.getElementById(`faq-chevron-${num}`);
  if (ans) {
    if (ans.classList.contains('hidden')) {
      ans.classList.remove('hidden');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
      ans.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  }
};

window.openFormulasModal = function() {
  const m = document.getElementById('formulas-modal');
  if (m) m.classList.remove('hidden');
};

window.closeFormulasModal = function() {
  const m = document.getElementById('formulas-modal');
  if (m) m.classList.add('hidden');
};

// Listeners de teclado y backdrop
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.closeFaqModal();
    window.closeFormulasModal();
    window.closeExerciseBankModal();
    window.closeGeneradorModal();
    window.closeHistoryModal();
  }
});

// ==========================================
// 13. INICIALIZACIÓN INMEDIATA
// ==========================================
function initApp() {
  window.selectSystem(window.AppState.system);
  window.selectMethod(window.AppState.method);
  window.renderOperationsTable();
  window.actualizarBadgeHistorial();

  // Backdrop listeners
  const faqModal = document.getElementById('faq-modal');
  if (faqModal) {
    faqModal.addEventListener('click', (e) => {
      if (e.target.id === 'faq-modal') window.closeFaqModal();
    });
  }

  const formulasModal = document.getElementById('formulas-modal');
  if (formulasModal) {
    formulasModal.addEventListener('click', (e) => {
      if (e.target.id === 'formulas-modal') window.closeFormulasModal();
    });
  }

  const bankModal = document.getElementById('exercise-bank-modal');
  if (bankModal) {
    bankModal.addEventListener('click', (e) => {
      if (e.target.id === 'exercise-bank-modal') window.closeExerciseBankModal();
    });
  }

  const genModal = document.getElementById('generador-ejercicios-modal');
  if (genModal) {
    genModal.addEventListener('click', (e) => {
      if (e.target.id === 'generador-ejercicios-modal') window.closeGeneradorModal();
    });
  }

  const histModal = document.getElementById('history-modal');
  if (histModal) {
    histModal.addEventListener('click', (e) => {
      if (e.target.id === 'history-modal') window.closeHistoryModal();
    });
  }

  // Sincronización en segundo plano con Cloud Firestore
  setTimeout(async () => {
    if (typeof window.obtenerHistorialFirestore === 'function') {
      try {
        const cloudItems = await window.obtenerHistorialFirestore();
        if (cloudItems && cloudItems.length > 0) {
          const locales = obtenerHistorial();
          const idsLocales = new Set(locales.map(l => l.id));
          let nuevos = 0;
          cloudItems.forEach(ci => {
            if (!idsLocales.has(ci.id)) {
              locales.push(ci);
              idsLocales.add(ci.id);
              nuevos++;
            }
          });
          if (nuevos > 0) {
            locales.sort((a, b) => new Date(b.fechaISO || 0) - new Date(a.fechaISO || 0));
            localStorage.setItem(HISTORIAL_STORAGE_KEY, JSON.stringify(locales));
            window.actualizarBadgeHistorial();
            console.log(`ContaPaso: ${nuevos} talleres sincronizados desde Firebase Firestore.`);
          }
        }
      } catch (e) {
        console.warn("ContaPaso: Sincronización inicial Firestore:", e);
      }
    }
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
