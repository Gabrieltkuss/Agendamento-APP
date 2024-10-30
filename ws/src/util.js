const moment = require('moment');

module.exports = {
  SLOT_DURATION: 30,
  isOpened: (horarios) => {
    // VERIFICANDO SE EXISTE REGISTRO NAQUELE DIA DA SEMANA
    const currentDay = moment().day();
    // console.log('Dia da semana atual:', currentDay);

    // Ajusta o dia da semana para o formato esperado (0 como domingo)
    // const adjustedDay = (currentDay + 6) % 7;
    // console.log('Dia da semana ajustado:', adjustedDay);

    const horariosDia = horarios.filter((h) => h.dias.includes(currentDay));
    // console.log('Horários para o dia da semana:', horariosDia);

    if (horariosDia.length > 0) {
      // VERIFICANDO HORARIOS
      for (let h of horariosDia) {
        const inicio = moment(h.inicio).format('HH:mm');
        const fim = moment(h.fim).format('HH:mm');
        // console.log('Horário de início:', inicio);
        // console.log('Horário de fim:', fim);

        const now = moment().format('HH:mm');
        // console.log('Horário atual:', now);

        if (moment(now, 'HH:mm').isBetween(moment(inicio, 'HH:mm'), moment(fim, 'HH:mm'))) {
          return true;
        }
      }
      return false;
    }
    return false;
  },

 toCents: (price) => {
    return parseInt(price.toString().replace('.','').replace(',',''));
 },

 hourToMinutes: (hourMinute) => {
   // 1:30
   const [ hour, minutes ] = hourMinute.split(':');
   return parseInt(parseInt(hour) * 60 + parseInt(minutes));
 },

 sliceMinutes: (start, end, duration) => {
  const slices = [];
  let count = 0;

  // 1:30 = 90
  start = moment(start);
  // 1:30 + 1:30 = 180
  end = moment(end);
  
  while(end > start) {

    slices.push(start.format('HH:mm'));

    start = start.add(duration, 'minutes');
    count++;
  }

  return slices;
 },

 mergeDateTime: (date, time) => {
  const merged = `${moment(date).format('YYYY-MM-DD')}T${moment(time).format(
    'HH:mm'
  )}`;
  //console.log(merged);
  return merged;
},

splitByValue: (array, value) => {
  let newArray = [[]];
  array.forEach((item) => {
    if (item !== value) {
      newArray[newArray.length - 1].push(item);
    } else {
      newArray.push([]);
    }
  });
  return newArray;
},
};