import * as React from 'react';
import { Slider } from '@material-ui/core';

const Mileage = ({miles, func}): React.ReactElement => {
  const handleChange = func;
  return (
    <div>
      <h2>How many miles did you drive this week?</h2>
      <div> <Slider className="slider"
        max={ 500 }
        step={ 25 }
        value={miles}
        onChange={handleChange}
        valueLabelDisplay="auto"
      /></div>
      <h4>10,484 pounds of C02 is produced per vehicle per year. The average American drives 216 miles per week, can you beat this? </h4>
    </div>
  );
};

export default Mileage;
