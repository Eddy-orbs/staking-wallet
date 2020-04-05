import { AppBarProps, Grid, Slide, ToolbarProps, Typography, useScrollTrigger } from '@material-ui/core';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import React from 'react';
import { LanguagesSelector } from './LanguagesSelector';
import styled from 'styled-components';
import { ContentContainer } from '../structure/ContentContainer';
import { ReactComponent as OrbsLogoAndIconSvg } from '../../../assets/logos/orbs_logo_with_icon.svg';
import { ReactComponent as TetraLogoAndIconSvg } from '../../../assets/logos/tetra_logo_with_icon.svg';

const StyledAppBar = styled(AppBar)<AppBarProps>({
  paddingTop: '1em',
  paddingBottom: '1em',
  borderBottom: '2px solid #363636',
  bottom: 0,
  top: 'auto',
});

const StyledToolBar = styled(Toolbar)<ToolbarProps>({});

const HideOnScroll = React.memo((props) => {
  const { children } = props;

  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction='up' in={trigger}>
      {children as any}
    </Slide>
  );
});

export const Footer = () => {
  return (
    <>
      {/* DEV_NOTE : Second 'Toolbar' is a trick offered by MUI to keep the content properly below the fixed AppBar */}
      {/* DEV_NOTE : We should add any 'bottom padding/margin' of the 'StyledAppBar' to the value we want to have from the page content*/}
      <Toolbar style={{ marginTop: '2.5em' }} />
      <HideOnScroll>
        <StyledAppBar position='fixed'>
          <ContentContainer>
            <StyledToolBar disableGutters>
              <Grid container direction={'row'} alignItems={'flex-start'} spacing={1}>
                <Grid item>
                  <a
                    href='https://orbs.com/tetra-privacy-policy'
                    target={'_blank'}
                    rel={'noopener noreferrer'}
                    style={{ color: 'inherit' }}
                  >
                    <Typography variant={'subtitle2'}>Privacy Policy</Typography>
                  </a>
                </Grid>
                <Grid item>
                  <a
                    href='https://orbs.com/tetra-terms-of-use'
                    target={'_blank'}
                    rel={'noopener noreferrer'}
                    style={{ color: 'inherit' }}
                  >
                    <Typography variant={'subtitle2'}>Terms of use</Typography>
                  </a>
                </Grid>
              </Grid>
            </StyledToolBar>
          </ContentContainer>
        </StyledAppBar>
      </HideOnScroll>
    </>
  );
};