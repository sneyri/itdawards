import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { Ceremony } from './pages/Ceremony'
import { CategoryDetail } from './pages/CategoryDetail'
import { Home } from './pages/Home'
import { MyVotes } from './pages/MyVotes'
import { Nominations } from './pages/Nominations'
import { NotFound } from './pages/NotFound'
import { Results } from './pages/Results'
import { SignIn } from './pages/SignIn'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="nominations" element={<Nominations />} />
        <Route path="nominations/:categoryId" element={<CategoryDetail />} />
        <Route path="results" element={<Results />} />
        <Route path="about" element={<About />} />
        <Route path="ceremony" element={<Ceremony />} />
        <Route path="my-votes" element={<MyVotes />} />
        <Route path="sign-in" element={<SignIn />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
