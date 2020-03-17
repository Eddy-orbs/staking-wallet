import React from 'react';
import styled from 'styled-components';
import { Divider } from '@material-ui/core';

const DIVIDER_MARGIN_EM = 0.6;

export const CommonDivider = styled(Divider)({
  backgroundColor: '#6C6D72',
  marginTop: `${DIVIDER_MARGIN_EM}em`,
  marginBottom: `${DIVIDER_MARGIN_EM}em`,
});
