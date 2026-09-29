import React, { useEffect } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { useMutation } from "@apollo/client"
import { Box, Button, Container, Group, MantineProvider, Text, createStyles, rem } from "@mantine/core"
import AuthOverlay from "../components/AuthOverlay"
import { useUserStore } from "../stores/userStore"
import { useGeneralStore } from "../stores/generalStore"
import { LOGOUT_USER } from "../graphql/mutations/Logout"
import "./account-shell.css"

const useStyles = createStyles((theme) => ({
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: theme.white,
    borderBottom: `1px solid ${theme.colors.gray[3]}`,
  },
  logo: {
    fontWeight: 700,
    fontSize: rem(18),
    color: theme.black,
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: rem(8),
  },
  mark: {
    width: rem(16),
    height: rem(16),
    border: `2px solid ${theme.colors.orange[7]}`,
    borderRadius: rem(3),
  },
  link: {
    color: theme.colors.gray[7],
    textDecoration: "none",
    fontSize: theme.fontSizes.sm,
    padding: `${rem(6)} ${rem(10)}`,
    borderRadius: theme.radius.sm,
    "&:hover": { background: theme.colors.gray[1] },
    "&.active": { color: theme.colors.orange[8], background: theme.colors.orange[0], fontWeight: 600 },
  },
}))

/** Brand theme for the product pages; the chat UI keeps the default theme. */
const theme = {
  primaryColor: "orange",
  primaryShade: 7 as const,
  fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif",
  headings: { fontFamily: "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif", fontWeight: 600 },
  defaultRadius: "md",
}

/** Asks for sign-in when a page needs it, without toggling an already open modal shut. */
export function useRequireLogin(required: boolean) {
  const userId = useUserStore((s) => s.id)
  useEffect(() => {
    // Set, never toggle: StrictMode runs effects twice in development.
    if (required && !userId) useGeneralStore.setState({ isLoginModalOpen: true })
  }, [required, userId])
  return userId
}

export default function AccountShell({ children }: { children: React.ReactNode }) {
  const { classes } = useStyles()
  const navigate = useNavigate()
  const user = useUserStore((s) => s)
  const toggleLogin = useGeneralStore((s) => s.toggleLoginModal)
  const [logout] = useMutation(LOGOUT_USER)

  const handleLogout = async () => {
    await logout().catch(() => undefined)
    useUserStore.setState({ id: undefined, fullname: "", avatarUrl: null, email: "" })
    navigate("/pricing")
  }

  return (
    <MantineProvider inherit theme={theme}>
      <div className="ap-shell">
      <AuthOverlay />
      <Box className={classes.header}>
        <Container size="lg">
          <Group position="apart" py="sm" noWrap>
            <Group spacing="lg" noWrap>
              <NavLink to="/product" className={classes.logo}>
                <span className={classes.mark} />
                AnchorProof
              </NavLink>
              <Group spacing={2} noWrap sx={{ overflowX: "auto" }}>
                <NavLink to="/product" className={classes.link}>Продукт</NavLink>
                <NavLink to="/pricing" className={classes.link}>Тарифи</NavLink>
                <NavLink to="/account" className={classes.link}>Кабінет</NavLink>
                <NavLink to="/verifiable-search" className={classes.link}>Демо пошуку</NavLink>
                <NavLink to="/" end className={classes.link}>Чати</NavLink>
              </Group>
            </Group>
            {user.id ? (
              <Group spacing="xs" noWrap>
                <Text size="sm" c="dimmed" truncate maw={180}>{user.fullname}</Text>
                <Button variant="subtle" color="gray" size="xs" onClick={handleLogout}>Вийти</Button>
              </Group>
            ) : (
              <Button size="xs" onClick={toggleLogin}>Увійти</Button>
            )}
          </Group>
        </Container>
      </Box>
      <Container size="lg" py="xl">{children}</Container>
      </div>
    </MantineProvider>
  )
}
